# JavaScript Authentication API

## Overview

The JavaScript Authentication API exposes user authentication information and functions to JavaScript handlers running in the QuickJS runtime. This allows your JavaScript code to check authentication status, require authentication, and access user information.

## Request Authentication Object

When a JavaScript handler is executed, authentication information is available via the `req.auth` property (or `request.auth` depending on your parameter name). This object contains the following properties and methods:

### Properties

#### `req.auth.isAuthenticated` (boolean)

Indicates whether the current request is from an authenticated user.

```javascript
function myHandler(context) {
  const req = context.request;
  if (req.auth.isAuthenticated) {
    console.log("User is logged in");
  } else {
    console.log("Anonymous user");
  }
}
```

#### `req.auth.userId` (string | null)

The unique identifier of the authenticated user, or `null` if not authenticated.

```javascript
function myHandler(context) {
  const req = context.request;
  if (req.auth.userId) {
    console.log(`User ID: ${req.auth.userId}`);
  }
}
```

#### `req.auth.userEmail` (string | null)

The email address of the authenticated user, or `null` if not available.

```javascript
function myHandler(context) {
  const req = context.request;
  if (req.auth.userEmail) {
    console.log(`Email: ${req.auth.userEmail}`);
  }
}
```

#### `req.auth.userName` (string | null)

The display name of the authenticated user, or `null` if not available.

```javascript
function myHandler(context) {
  const req = context.request;
  if (req.auth.userName) {
    console.log(`Welcome, ${req.auth.userName}!`);
  }
}
```

#### `req.auth.provider` (string | null)

The OAuth2 provider used for authentication (`"google"`, `"microsoft"`, or `"apple"`), or `null` if not authenticated.

```javascript
function myHandler(context) {
  const req = context.request;
  if (req.auth.provider === "google") {
    console.log("Authenticated via Google");
  }
}
```

#### `req.auth.isAdmin` (boolean)

Indicates whether the current user has administrator privileges.

```javascript
function myHandler(context) {
  const req = context.request;
  if (req.auth.isAdmin) {
    console.log("User is an administrator");
  }
}
```

#### `req.auth.isEditor` (boolean)

Indicates whether the current user has editor privileges.

```javascript
function myHandler(context) {
  const req = context.request;
  if (req.auth.isEditor) {
    console.log("User is an editor");
  }
}
```

### Properties (User Object)

#### `req.auth.user` → object | null

The complete user object when authenticated, or `null` if not authenticated.

**Type:**

```typescript
{
    id: string | null,
    email: string | null,
    name: string | null,
    provider: string | null,
    isAuthenticated: boolean
} | null
```

**Example:**

```javascript
function myHandler(context) {
  const req = context.request;
  const user = req.auth.user;
  if (user) {
    console.log(`User ${user.id} logged in via ${user.provider}`);
    if (user.email) {
      console.log(`Email: ${user.email}`);
    }
  } else {
    console.log("No user logged in");
  }
}
```

#### `req.auth.requireAuth()` → object

Returns the current user object if authenticated, or **throws an error** if not authenticated.

Use this in handlers that require authentication - it will automatically reject anonymous requests.

**Returns:**

```typescript
{
    id: string,
    email?: string,
    name?: string,
    provider: string,
    isAuthenticated: true
}
```

**Throws:** `Error` with message `"Authentication required. Please login to access this resource."`

**Example:**

```javascript
// Protected endpoint - only accessible to authenticated users
function protectedHandler(context) {
  const req = context.request;
  // This will throw an error if not authenticated
  const user = req.auth.requireAuth();

  return {
    status: 200,
    body: JSON.stringify({
      message: `Hello ${user.name || user.id}!`,
      data: {
        userId: user.id,
        provider: user.provider,
      },
    }),
    contentType: "application/json",
  };
}
```

## Usage Examples

### Public Endpoint (Optional Authentication)

```javascript
function greetingHandler(context) {
  const req = context.request;
  if (req.auth.isAuthenticated) {
    return {
      status: 200,
      body: JSON.stringify({
        message: `Hello, ${req.auth.userName || req.auth.userId}!`,
        personalized: true,
      }),
      contentType: "application/json",
    };
  } else {
    return {
      status: 200,
      body: JSON.stringify({
        message: "Hello, Guest!",
        personalized: false,
      }),
      contentType: "application/json",
    };
  }
}
```

### Protected Endpoint (Required Authentication)

```javascript
function profileHandler(context) {
  const req = context.request;
  const user = req.auth.requireAuth(); // Throws if not authenticated

  return {
    status: 200,
    body: JSON.stringify({
      profile: {
        id: user.id,
        email: user.email,
        name: user.name,
        provider: user.provider,
      },
    }),
    contentType: "application/json",
  };
}
```

### Conditional Logic Based on Provider

```javascript
function dataHandler(context) {
  const req = context.request;
  const user = req.auth.user;

  if (!user) {
    return {
      status: 401,
      body: JSON.stringify({ error: "Authentication required" }),
      contentType: "application/json",
    };
  }

  // Different behavior based on OAuth provider
  let dataSource;
  switch (user.provider) {
    case "google":
      dataSource = "Google Workspace";
      break;
    case "microsoft":
      dataSource = "Microsoft 365";
      break;
    case "apple":
      dataSource = "iCloud";
      break;
    default:
      dataSource = "Unknown";
  }

  return {
    status: 200,
    body: JSON.stringify({
      message: `Data from ${dataSource}`,
      user: user.id,
    }),
    contentType: "application/json",
  };
}
```

### User-Specific Resources

```javascript
function userDataHandler(context) {
  const req = context.request;
  if (!req.auth.isAuthenticated) {
    return {
      status: 401,
      body: JSON.stringify({ error: "Unauthorized" }),
      contentType: "application/json",
    };
  }

  // Use user ID to fetch user-specific data
  const userData = getUserData(req.auth.userId);

  return {
    status: 200,
    body: JSON.stringify({
      userId: req.auth.userId,
      data: userData,
    }),
    contentType: "application/json",
  };
}
```

### Graceful Degradation

```javascript
function contentHandler(context) {
  const req = context.request;
  const user = req.auth.user;

  // Public content available to everyone
  const publicContent = getPublicContent();

  if (user) {
    // Additional private content for authenticated users
    const privateContent = getPrivateContent(user.id);

    return {
      status: 200,
      body: JSON.stringify({
        public: publicContent,
        private: privateContent,
        user: {
          id: user.id,
          name: user.name,
        },
      }),
      contentType: "application/json",
    };
  } else {
    return {
      status: 200,
      body: JSON.stringify({
        public: publicContent,
        message: "Login to see more content",
      }),
      contentType: "application/json",
    };
  }
}
```

## Error Handling

### Handling `requireAuth()` Errors

```javascript
function secureHandler(context) {
  const req = context.request;
  try {
    const user = req.auth.requireAuth();

    return {
      status: 200,
      body: JSON.stringify({
        message: "Access granted",
        userId: user.id,
      }),
      contentType: "application/json",
    };
  } catch (error) {
    // This will catch authentication errors
    return {
      status: 401,
      body: JSON.stringify({
        error: error.message,
        authorizeUrl: "/oauth2/authorize",
      }),
      contentType: "application/json",
    };
  }
}
```

### Custom Authentication Check

```javascript
function requireUser(req) {
  if (!req.auth.isAuthenticated) {
    throw new Error("Please login to access this resource");
  }
  return req.auth.user;
}

function customProtectedHandler(context) {
  const req = context.request;
  const user = requireUser(req);

  return ResponseBuilder.json({
    message: "Authenticated!",
    user: user.id,
  });
}
```

## Integration with Request Context

The authentication context is automatically extracted from:

1. `Authorization: Bearer <token>` header
2. `session` cookie

The middleware handles authentication before your JavaScript handler runs, so the `req.auth` object is always available and up-to-date.

## HTTP Authentication Endpoints

The engine also exposes HTTP authentication endpoints described by the OpenAPI spec. These are useful for external OAuth clients, debugging auth state, and standards-based discovery.

### `GET /auth/status`

Returns the current authentication status for the caller.

**Response shape:**

```json
{
  "authenticated": true,
  "user_id": "user_123",
  "username": "alice",
  "roles": ["editor"]
}
```

**Notes:**

- `authenticated` is always present.
- `user_id`, `username`, and `roles` may be `null` when the caller is anonymous.

### `GET /.well-known/oauth-authorization-server`

Returns OAuth 2.0 authorization server metadata as defined by RFC 8414.

**Typical fields:**

```json
{
  "issuer": "https://example.com",
  "authorization_endpoint": "https://example.com/oauth2/authorize",
  "token_endpoint": "https://example.com/oauth2/token",
  "response_types_supported": ["code"],
  "code_challenge_methods_supported": ["S256"],
  "registration_endpoint": "https://example.com/oauth2/register"
}
```

### `GET /.well-known/oauth-protected-resource`

Returns protected resource metadata for OAuth clients.

**Typical fields:**

```json
{
  "resource": "https://example.com",
  "authorization_servers": ["https://example.com"],
  "bearer_methods_supported": ["header"]
}
```

### `GET /oauth2/authorize`

Authorization endpoint for OAuth 2.0 authorization code flow.

**Query parameters:**

- `response_type` required, must be `code`
- `client_id` required
- `redirect_uri` optional
- `scope` optional
- `state` optional
- `code_challenge` optional
- `code_challenge_method` optional
- `resource` optional

If the user is not already authenticated, the endpoint may redirect to the engine's login flow before continuing authorization.

### `POST /oauth2/token`

Token endpoint for exchanging an authorization code for an access token.

**Request content type:** `application/x-www-form-urlencoded`

**Response shape:**

```json
{
  "access_token": "vlN4nZl9oxyG4Ux99CuqOJXJSxOqCfsWxmZJrblTcG8",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "vlN4nZl9oxyG4Ux99CuqOJXJSxOqCfsWxmZJrblTcG8",
  "scope": "openid"
}
```

**Notes:**

- `access_token` and `token_type` are always present.
- `expires_in`, `refresh_token`, and `scope` are optional.
- Clients should treat this shape as the contract exposed by the OpenAPI spec.

### `POST /oauth2/register`

Dynamic client registration endpoint. Accepts a JSON request body and returns the registered client metadata.

## Security Considerations

### Never Trust Client Data for Authentication

```javascript
// ❌ BAD - Don't trust user-provided data
function badExampleHandler(context) {
  const req = context.request;
  const userId = req.query.userId; // DON'T DO THIS
  // Attacker could impersonate any user
}

// ✅ GOOD - Use authenticated user ID
function goodExampleHandler(context) {
  const req = context.request;
  const user = req.auth.requireAuth();
  const userId = user.id; // This is verified by the server
  // Safe to use for authorization
}
```

### Check Authentication, Not Just Presence

```javascript
// ❌ RISKY - Checking if userId exists
function riskyHandler(context) {
  const req = context.request;
  if (req.auth.userId) {
    // This is okay but requireAuth() is clearer
  }
}

// ✅ BETTER - Use requireAuth() for clarity
function betterHandler(context) {
  const req = context.request;
  const user = req.auth.requireAuth();
  // Intent is clear - authentication required
}
```

### Separate Public and Private Endpoints

```javascript
// Public endpoint
function publicStatusHandler(context) {
  return ResponseBuilder.json({ status: "online" });
}

// Private endpoint
function adminHandler(context) {
  const req = context.request;
  const user = req.auth.requireAuth();

  // Add additional authorization checks
  if (!req.auth.isAdmin) {
    return {
      status: 403,
      body: JSON.stringify({ error: "Admin access required" }),
      contentType: "application/json",
    };
  }

  return {
    status: 200,
    body: JSON.stringify({ admin: true }),
    contentType: "application/json",
  };
}
```

## Implementation Details

### Context Extraction

The `req.auth` object is populated from the request's session token, which is validated by the authentication middleware before the JavaScript handler runs.

### Performance

Authentication context is extracted once per request and cached, so there's no performance penalty for accessing `req.auth` properties multiple times in your handler.

### Null Safety

All user information properties (`userId`, `userEmail`, `userName`, `provider`) are `null` when not authenticated or not available, making them safe to check with standard JavaScript truthiness checks:

```javascript
function myHandler(context) {
  const req = context.request;
  if (req.auth.userName) {
    // userName is available and not null
  }
}
```

## See Also

- [JavaScript APIs Reference](./javascript-apis.md) - General runtime APIs available to scripts
- [Getting Started](../getting-started/01-first-script.md) - Building your first script with handler context
- [Streaming Guide](../guides/streaming.md) - Using auth-aware stream metadata and filtered delivery

---

**Version:** 2.0  
**Last Updated:** November 2025
