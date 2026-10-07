# Real-Time Streaming Guide

How to push live updates to browsers with Server-Sent Events (SSE): register a
stream, decide who may subscribe, and send to everyone or to a chosen few.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
- [Who May Subscribe, and Selective Broadcasting](#who-may-subscribe-and-selective-broadcasting)
- [Client Integration](#client-integration)
- [Use Cases](#use-cases)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

A script registers a stream path in `init()`; browsers connect to it with the
standard `EventSource` API; the script sends messages to it from any handler,
scheduled job or task.

```text
script                      engine                         browsers
  | init(): registerRoute     |                               |
  |   (path, {stream: true})  |                               |
  |-------------------------->|  <--- new EventSource(path) --|
  |                           |       (authorize runs here)   |
  | sendStreamMessage(path,…) |                               |
  |-------------------------->|---- data: {...} ------------->|
```

- Every instance of a cluster delivers a message to its own connections; a
  message sent on one instance reaches subscribers on all of them.
- Connections are cleaned up when a client disconnects.
- Messages go one way, server to browser. A browser sends with an ordinary
  `POST` to a handler.

## Quick Start

```javascript
function triggerEvent(context) {
  const result = routeRegistry.sendStreamMessage("/my-app/events", {
    type: "event",
    message: "Something happened!",
    timestamp: new Date().toISOString(),
  });
  return ResponseBuilder.json(result); // { delivered, connections, failed }
}

function page(context) {
  return ResponseBuilder.html(`<!DOCTYPE html>
<html><body>
  <div id="events"></div>
  <script>
    const events = new EventSource("/my-app/events");
    events.onmessage = (event) => {
      const data = JSON.parse(event.data);
      document.getElementById("events").insertAdjacentHTML(
        "beforeend", "<p>" + data.message + " at " + data.timestamp + "</p>");
    };
  </script>
</body></html>`);
}

function init() {
  routeRegistry.registerRoute("/my-app/events", { stream: true });
  routeRegistry.registerRoute("/my-app/trigger", {
    handler: "triggerEvent",
    method: "POST",
  });
  routeRegistry.registerRoute("/my-app", { handler: "page" });
}
```

Open `/my-app` in a browser, then:

```bash
curl -X POST http://localhost:3000/my-app/trigger
```

## API Reference

### routeRegistry.registerRoute(path, { stream: true, authorize? })

Registers a Server-Sent Events endpoint. Only in `init()`.

- `path` (string): starts with `/`, at most 500 characters; `:param` and a
  trailing `/*` work. A connection is filed under the path the browser
  opened, so with `/chat/:room/events` a message goes to
  `/chat/general/events`, not to the pattern.
- `authorize` (string, optional): the name of the function that decides who
  may connect, and what the connection is filed under — see below. Without
  one, anyone who can reach the host may connect.

**Returns** `{ ok: true }`, or `{ ok: false, reason }` when the path is held by
another script or the call is made outside `init()`. **Throws** if the path is
malformed or reserved, or the caller lacks the `ManageStreams` capability.

### routeRegistry.sendStreamMessage(path, data)

Sends `data` (any JSON value) to every connection on `path`.

**Returns** `{ delivered, connections, failed }`. A stream nobody is connected
to answers zeros; a failure throws.

### routeRegistry.sendStreamMessageFiltered(path, data, filter?, matchMode?)

Sends `data` only to the connections whose criteria — what `authorize`
returned for them — match `filter`.

- `filter` (object of strings, optional): omit it, or pass `{}`, to reach every
  connection.
- `matchMode` (string, optional): `"subset"` (default) — every filter entry
  must match — or `"overlap"`, where any one may.

**Returns** `{ delivered, connections, failed }`.

## Who May Subscribe, and Selective Broadcasting

The `authorize` function runs when a browser connects, with the connecting
request in `context.request` (its `auth`, `params` and `query`). It answers
either a refusal — `{ deny: 401 }`, or any 4xx, with an optional `reason` — or
the connection's **criteria**: a flat object of strings that
`sendStreamMessageFiltered` matches against.

Because the criteria come from your function, a client cannot claim to be
somebody else. Take identity from `auth`, never from a query parameter:

```javascript
// Who may watch an order, and which order a connection is about
function mayWatchOrder(context) {
  const auth = context.request.auth;
  if (!auth.isAuthenticated) return { deny: 401 };
  const orderId = context.request.query.order;
  if (!orderId) return { deny: 400, reason: "order is required" };
  const order = database.query("orders", { where: { id: Number(orderId) } })[0];
  if (!order || order.owner !== auth.userId) {
    return { deny: 404 };
  }
  return { user_id: auth.userId, order_id: orderId };
}

function markShipped(context) {
  const { orderId } = context.request.json();
  // ... update the order ...
  routeRegistry.sendStreamMessageFiltered(
    "/shop/order-events",
    { type: "shipped", orderId },
    { order_id: String(orderId) },
  );
  return ResponseBuilder.noContent();
}

function init() {
  routeRegistry.registerRoute("/shop/order-events", {
    stream: true,
    authorize: "mayWatchOrder",
  });
  routeRegistry.registerRoute("/shop/ship", {
    handler: "markShipped",
    method: "POST",
  });
}
```

The browser connects with `new EventSource("/shop/order-events?order=1234")`;
the session cookie identifies the person.

Filter examples:

```javascript
sendStreamMessageFiltered("/chat", msg, { user_id: "u-42" }); // one person
sendStreamMessageFiltered("/chat", msg, { room: "general", role: "admin" }); // both must match
sendStreamMessageFiltered("/chat", msg, { room: "a", room2: "b" }, "overlap"); // either may
sendStreamMessageFiltered("/chat", msg, {}); // everyone
```

`authorize` throwing is not a refusal: it answers 500. Return `{ deny: ... }`.

## Client Integration

### EventSource API

```javascript
const events = new EventSource("/my-app/events");

events.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log("Received:", data);
};
events.onopen = () => console.log("Stream connected");
events.onerror = () => {
  // EventSource reconnects by itself; show "reconnecting" meanwhile
};
// events.close() when done
```

Dispatching on a `type` field keeps one stream useful for several kinds of
message:

```javascript
const handlers = {
  notification: (data) => showNotification(data.title, data.body),
  update: (data) => updateUI(data),
};
events.onmessage = (event) => {
  const data = JSON.parse(event.data);
  (handlers[data.type] || console.log)(data);
};
```

A first page load should fetch the current state with an ordinary `GET`, since
a stream delivers only what is sent after the connection opens.

### curl Testing

```bash
# Connect to a stream
curl -N -H "Accept: text/event-stream" http://localhost:3000/my-app/events

# In another terminal, trigger an event
curl -X POST http://localhost:3000/my-app/trigger
```

## Use Cases

### Live Dashboard from a Scheduled Job

```javascript
function publishMetrics(context) {
  const counts = database.query("orders", { where: { status: "open" } }).length;
  routeRegistry.sendStreamMessage("/ops/dashboard", {
    type: "metrics",
    openOrders: counts,
    at: new Date().toISOString(),
  });
}

function init() {
  routeRegistry.registerRoute("/ops/dashboard", {
    stream: true,
    authorize: "staffOnly",
  });
  schedulerService.registerRecurring({
    handler: "publishMetrics",
    intervalMilliseconds: 10000,
    name: "publish-metrics",
  });
}

function staffOnly(context) {
  const auth = context.request.auth;
  if (!auth.isAuthenticated) return { deny: 401 };
  return database.query("staff", { where: { user_id: auth.userId } }).length
    ? { user_id: auth.userId }
    : { deny: 403 };
}
```

A recurring job runs whether anybody watches; `delivered: 0` from
`sendStreamMessage` is a cheap way to skip expensive work when nobody is
connected.

### Chat Rooms

```javascript
function mayJoin(context) {
  const auth = context.request.auth;
  if (!auth.isAuthenticated) return { deny: 401 };
  return { user_id: auth.userId };
}

function sendToRoom(context) {
  const auth = context.request.auth;
  if (!auth.isAuthenticated) return ResponseBuilder.error(401, "Sign in");
  const room = context.request.params.room;
  const { text } = context.request.json();
  // Send to the path the browsers opened, not the pattern
  routeRegistry.sendStreamMessage(`/chat/${room}/events`, {
    type: "message",
    from: auth.userName,
    text,
  });
  return ResponseBuilder.noContent();
}

function init() {
  routeRegistry.registerRoute("/chat/:room/events", {
    stream: true,
    authorize: "mayJoin",
  });
  routeRegistry.registerRoute("/chat/:room/send", {
    handler: "sendToRoom",
    method: "POST",
  });
}
```

## Best Practices

- **Register streams in `init()`** and read the result; a path another script
  holds is refused.
- **One stream per kind of thing, filtered**, rather than a path per user: the
  `authorize` criteria are what make a stable path personal.
- **Identity comes from `auth`** in `authorize`, never from what the client
  put in the URL.
- **Give messages a `type`** and a timestamp, and keep them small.
- **Send state the client can apply as-is** (the new value), so a reconnect
  followed by one `GET` brings a client back in step.
- **Handle reconnects in the client**: `EventSource` retries by itself; show
  that it is reconnecting and refetch state when it opens again.

## Troubleshooting

| Symptom                            | Check                                                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| The browser gets 404               | Was the stream registered in `init()`, and did registration answer `ok: true`? `list_routes` shows `STREAM`. |
| The browser gets 401/403           | Your `authorize` function refused; its `reason` is in the response.                                          |
| Connected, but nothing arrives     | `sendStreamMessage`'s result: `connections: 0` means the path differs from the one the browser opened.       |
| A filtered send delivers 0         | The filter must match the criteria `authorize` returned, as strings: `"42"` is not `42`.                     |
| Messages stop from a scheduled job | The job's log (`read_logs` with `kind=scheduled`): a throw there is invisible from the browser.              |

## Next Steps

- **[Script Development](scripts.md)** - Handlers, state and routes
- **[API Reference](../reference/javascript-apis.md)** - Every global
- **[Examples](../examples/index.md)** - The chat and virtual-world examples use streams
