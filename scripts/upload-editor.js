#!/usr/bin/env node
/// <reference types="node" />
require("dotenv").config();
// Upload editor.js script and assets to the server
// Requires authentication token from schemas/token.json (run `make oauth-login` first)
// Usage:
//   node scripts/upload-editor.js
// Env:
//   SERVER_HOST (default: https://softagen.com)

const fs = require("fs");
const path = require("path");

const serverHost = process.env.SERVER_HOST || "https://softagen.com";

/**
 * Load OAuth token from schemas/token.json
 * @returns {Promise<string>}
 */
async function loadToken() {
  const tokenPath = path.join(__dirname, "..", "schemas", "token.json");
  try {
    const tokenData = await fs.promises.readFile(tokenPath, "utf8");
    const token = JSON.parse(tokenData);

    // Check if token is expired
    if (token.expires_at && Date.now() > token.expires_at) {
      throw new Error(
        "Token has expired. Please run 'make oauth-login' again.",
      );
    }

    return token.access_token;
  } catch (err) {
    if (err.code === "ENOENT") {
      throw new Error("Token not found. Please run 'make oauth-login' first.");
    }
    throw err;
  }
}

/**
 * Upload the editor.js script
 * @param {string} token
 */
async function uploadScript(token) {
  const scriptPath = path.join(__dirname, "..", "src", "editor", "editor.js");
  const scriptContent = await fs.promises.readFile(scriptPath, "utf8");

  console.log(`Uploading script editor.js (${scriptContent.length} bytes)...`);

  const body = new URLSearchParams({
    uri: "https://example.com/editor",
    content: scriptContent,
  }).toString();

  console.log(`Request: POST ${serverHost}/upsert_script`);
  console.log(`Body length: ${body.length} bytes`);

  const response = await fetch(`${serverHost}/upsert_script`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Bearer ${token}`,
    },
    body: body,
  });

  console.log(`Response status: ${response.status} ${response.statusText}`);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Failed to upload script: ${response.status} ${response.statusText}\n${text}`,
    );
  }

  const text = await response.text();
  console.log(`Response body: ${text}`);

  let result;
  try {
    result = JSON.parse(text);
  } catch (e) {
    result = { message: text };
  }

  console.log(
    `✓ Script uploaded successfully: ${result.message || result.success || "OK"}`,
  );
}

/**
 * Get MIME type from file extension
 * @param {string} filename
 * @returns {string}
 */
function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
    ".html": "text/html",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".ico": "image/x-icon",
  };
  return mimeTypes[ext] || "application/octet-stream";
}

/**
 * Upload an asset file
 * Note: Assets are stored by name (e.g., "editor.css") in the new system.
 * The API accepts publicPath for backwards compatibility, but it converts
 * it to an asset name. Assets must be registered to HTTP paths using
 * routeRegistry.registerAssetRoute() in the script's init() function.
 * @param {string} token
 * @param {string} assetName - The asset name (e.g., "editor.css")
 * @param {string} assetPath - Local file path to read
 */
async function uploadAsset(token, assetName, assetPath) {
  const content = await fs.promises.readFile(assetPath);
  const base64Content = content.toString("base64");
  const mimetype = getMimeType(assetName);

  console.log(`Uploading asset ${assetName} (${content.length} bytes)...`);

  const response = await fetch(`${serverHost}/api/assets`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      publicPath: `/${assetName}`, // API converts this to asset name (removes leading slash)
      mimetype: mimetype,
      content: base64Content,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Failed to upload asset ${assetName}: ${response.status} ${response.statusText}\n${text}`,
    );
  }

  const result = await response.json();
  console.log(`✓ Asset ${assetName} uploaded successfully`);
}

async function main() {
  try {
    console.log(`Uploading editor files to ${serverHost}...`);
    console.log("");

    // Load authentication token
    const token = await loadToken();
    console.log("✓ Authentication token loaded");
    console.log("");

    // Upload script
    await uploadScript(token);
    console.log("");

    // Upload assets
    const assetsDir = path.join(__dirname, "..", "src", "editor", "assets");
    await uploadAsset(token, "editor.css", path.join(assetsDir, "editor.css"));
    await uploadAsset(token, "editor.js", path.join(assetsDir, "editor.js"));

    console.log("");
    console.log("✓ All editor files uploaded successfully!");
    console.log(`Visit ${serverHost}/engine/editor to see your changes.`);
  } catch (err) {
    console.error("Error:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

main();
