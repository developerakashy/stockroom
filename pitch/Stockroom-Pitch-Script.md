# Stockroom walkthrough

## 0:00 · Start locally

A caller wants two mugs. There are five left. What happens if someone at the next desk sells them while we're on the phone?

Let's start Stockroom locally. Docker runs Postgres. The README lists the environment settings and dependencies. The seed adds six products, and the dev command starts the console and its API.

## 0:19 · Take the call

Here's the shelf. The Studio Mug has five left. The Trail Bottle has zero, so its add button is disabled.

I'll put two mugs and a Field Notebook in the draft. That's forty-eight rupees and fifty paise. The mugs are still available until I actually place the order.

## 0:36 · Commit the order

Now I'll place it. Here's the reference I can read back to the caller.

The server priced each line in whole paise and saved the prices with the order. Both mugs and the notebook came out of stock in the same database transaction.

## 0:49 · Find and pack

At the packing desk, I open the dashboard and choose To pack. If the caller rings back, I can type the last few characters of their reference.

Opening that result shows exactly what goes in the box. Two mugs. One notebook. Now I can mark it packed.

## 1:05 · Hand off the parcel

Packed puts it in the ready to ship queue. I can leave it here until the courier actually takes it.

After handoff, I mark it shipped. The timeline keeps the three timestamps, and this order is complete.

## 1:17 · Handle a cancellation

Here's a different caller who changes their mind. Their order is still placed, so I can cancel it.

The confirmation tells me the units will go back on the shelf. Once I confirm, the dashboard records the cancellation. The same option is available on a packed order.

## 1:33 · Prove both acceptance examples

What if someone sends a bad request directly? In a fresh test database I asked for two mugs and one sold-out bottle. The server rejected the whole cart. Five mugs remained, and there were zero orders.

Two mugs on their own went through. Stock dropped to three. Trying to jump straight to shipped failed. Cancelling restored five. Cancelling again returned a conflict, and the count stayed at five.

## 1:56 · Explain the implementation

The React interface keeps a draft in the tab with Zustand. TanStack Query refreshes the catalogue after checkout. Nest and Fastify receive the request, and Zod checks its shape.

Drizzle locks the product rows in a consistent order before checking availability. On cancellation, the server locks the order first. A second request sees that it's already cancelled before it can add anything back.

## 2:21 · Run the tests

The README includes the commands to reproduce this. Seventeen API tests passed, including placement, insufficient stock, and an invalid state change. Eleven browser tests passed as well.

Then two server processes competed for the same stock. Out of a hundred and twenty checkout attempts, twelve orders took the twenty-four available notebooks. The other requests got a conflict. A restart preserved all thirteen orders from the full run and the exact inventory.

## 2:50 · Finish at the desk

Back at the desk, the shipped parcel and the cancelled order are both searchable. The next person answering the phone can see what happened, and how much stock they can promise.
