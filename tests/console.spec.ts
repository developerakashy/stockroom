import { expect, type Locator, type Page, test } from "@playwright/test";

async function expectHorizontalTimeline(dialog: Locator) {
  const timeline = dialog.getByRole("list", { name: "Fulfilment timeline" });
  const steps = timeline.getByRole("listitem");
  await expect(steps).toHaveCount(3);
  await dialog.evaluate((element) =>
    Promise.all(element.getAnimations().map((animation) => animation.finished)),
  );
  const bounds = await Promise.all(
    [0, 1, 2].map((index) => steps.nth(index).boundingBox()),
  );
  const [placed, packed, shipped] = bounds;
  expect(placed?.y).toBe(packed?.y);
  expect(packed?.y).toBe(shipped?.y);
  expect(placed?.x ?? 0).toBeLessThan(packed?.x ?? 0);
  expect(packed?.x ?? 0).toBeLessThan(shipped?.x ?? 0);
}

async function expectCentered(page: Page, dialog: Locator) {
  const box = await dialog.boundingBox();
  const viewport = page.viewportSize();
  expect((box?.x ?? 0) + (box?.width ?? 0) / 2).toBeCloseTo(
    (viewport?.width ?? 0) / 2,
    0,
  );
  expect((box?.y ?? 0) + (box?.height ?? 0) / 2).toBeCloseTo(
    (viewport?.height ?? 0) / 2,
    0,
  );
}

test("staff can edit a recommended product, preview the cart, place and fulfil an order", async ({
  page,
}) => {
  await page.addInitScript(() => {
    document.addEventListener("animationstart", (event) => {
      if (event.animationName === "order-dialog-out")
        document.documentElement.dataset.orderExitPlayed = "true";
    });
  });
  await page.goto("/orders");
  await expect(page.getByRole("main")).toHaveCSS("animation-name", "page-in");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  const recommendations = page.getByRole("complementary", {
    name: "Recommended products",
  });
  await expect(
    recommendations.getByRole("link", { name: "Browse all products" }),
  ).toBeVisible();
  await recommendations.getByText("Studio Mug", { exact: true }).click();
  await expect(page).toHaveURL(/\/orders$/);
  await expect(
    recommendations.getByRole("link", { name: "Studio Mug" }),
  ).toHaveCount(0);
  await recommendations.getByRole("button", { name: "Add Studio Mug" }).click();
  await recommendations.getByRole("button", { name: "Add Studio Mug" }).click();
  await recommendations
    .getByRole("button", { name: "Add Field Notebook" })
    .click();
  await recommendations
    .getByRole("button", { name: "Remove Field Notebook" })
    .click();

  const cartNav = page.getByRole("link", { name: "Cart 2" });
  const preview = page.locator(".cart-preview");
  await expect(preview).toHaveCSS("opacity", "0");
  await expect(preview).toHaveCSS(
    "transition-property",
    "opacity, transform, visibility",
  );
  await cartNav.hover();
  await expect(preview).toHaveCSS("opacity", "1");
  await page.getByRole("heading", { name: "Dashboard", exact: true }).hover();
  await expect(preview).toBeHidden();
  await cartNav.hover();
  await expect(page.getByRole("link", { name: "View cart" })).toBeVisible();
  await expect(page.getByText("2 × ₹18.00", { exact: true })).toBeVisible();
  const tabs = page.locator(".main-tabs");
  await expect(tabs).toHaveAttribute("data-active", "dashboard");
  await page.getByRole("link", { name: "View cart" }).click();
  await expect(tabs).toHaveAttribute("data-active", "products");
  await expect
    .poll(() =>
      tabs.evaluate((element) => {
        const indicator = getComputedStyle(element, "::before");
        return (
          indicator.transitionProperty === "transform" &&
          new DOMMatrixReadOnly(indicator.transform).m41 > 0
        );
      }),
    )
    .toBe(true);
  await expect(page).toHaveURL(/\/products#draft-cart$/);
  await page.reload();
  const catalogue = page.getByRole("region", { name: "Product catalogue" });
  const cart = page.getByRole("region", { name: "Order summary", exact: true });
  await expect(catalogue).toBeVisible();
  await expect(cart).toBeVisible();
  const [catalogueBox, cartBox] = await Promise.all([
    catalogue.boundingBox(),
    cart.boundingBox(),
  ]);
  expect(cartBox?.x ?? 0).toBeGreaterThan(
    (catalogueBox?.x ?? 0) + (catalogueBox?.width ?? 0),
  );
  await expect(
    page.getByRole("heading", { name: "Order summary", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("₹36.00", { exact: true })).toHaveCount(2);
  await expect(cart.getByText("2 × ₹18.00", { exact: true })).toBeVisible();
  await expect(cart.locator(".interactive-hover-fill")).toHaveCount(0);
  await page.getByRole("button", { name: "Place order" }).click();
  const confirmation = page.getByRole("dialog", { name: "Order confirmation" });
  await expect(
    confirmation.getByRole("heading", { name: "Order confirmed" }),
  ).toBeVisible();
  await expect(
    confirmation.getByText("2 × ₹18.00", { exact: true }),
  ).toBeVisible();
  await expectHorizontalTimeline(confirmation);
  await expect(confirmation).toHaveCSS("animation-name", "order-dialog-in");
  await expect(page).toHaveURL(/\/products\?order=ORD-/);
  await expect(
    confirmation.getByRole("link", { name: "Go to dashboard" }),
  ).toBeVisible();
  await expectCentered(page, confirmation);
  const reference = new URL(page.url()).searchParams.get("order") ?? "";
  await confirmation
    .getByRole("button", { name: "Close order details" })
    .click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-order-exit-played",
    "true",
  );
  await expect(confirmation).toBeHidden();
  await expect(page).toHaveURL(/\/products#draft-cart$/);
  await expect(cart.getByText("Your cart is empty.")).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Dashboard" })
    .click();
  const details = page.getByRole("dialog", { name: "Order details" });

  await expect(
    recommendations.getByText("2 ordered", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: /To pack 1/ }).click();
  const filter = page.getByRole("combobox", { name: "Status" });
  await expect(filter).toHaveText("To pack");
  await page
    .getByRole("textbox", { name: "Search by order reference" })
    .fill(reference);
  const row = page.getByRole("row").filter({ hasText: reference });
  await row.getByRole("button", { name: "Pack", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("marked as packed");
  await page.getByRole("button", { name: /Ready to ship 1/ }).click();
  await expect(filter).toHaveText("Ready to ship");
  const activeQueue = page.getByRole("button", { name: /Ready to ship 1/ });
  await expect(activeQueue).toHaveAttribute("aria-pressed", "true");
  await expect(activeQueue).toHaveCSS("background-color", "rgb(247, 247, 247)");
  await expect(filter).toHaveCSS("background-color", "rgb(250, 250, 250)");
  await row.getByRole("link", { name: reference }).click();
  await expect(details.getByRole("heading", { name: reference })).toBeVisible();
  await expectHorizontalTimeline(details);
  await expectCentered(page, details);
  await expect(
    details.getByRole("button", { name: "Mark as shipped" }),
  ).toBeVisible();
  await details.getByRole("button", { name: "Close order details" }).click();
  await row.getByRole("button", { name: "Cancel order" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Cancel order" })
    .click();
  await expect(page.getByRole("status")).toContainText("Stock restored");
  await expect(page.getByRole("button", { name: /Cancelled 1/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Cart 0" })).toBeVisible();
});

test("product details distinguish draft quantity from stock and the cart recovers from a conflict", async ({
  page,
  request,
}) => {
  await page.goto("/products");
  await expect(
    page.getByRole("button", { name: "Add Trail Bottle" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: /Out of stock 1/ }).click();
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.getByRole("button", { name: /Low stock/ }).click();
  const trayCard = page.getByRole("article").filter({ hasText: "Desk Tray" });
  await trayCard.getByRole("heading", { name: "Desk Tray" }).click();
  await expect(page).toHaveURL(/\/products$/);
  await trayCard.getByRole("button", { name: "Add Desk Tray" }).click();
  await expect(page.getByRole("button", { name: "Cart 1" })).toBeDisabled();
  const cart = page.getByRole("region", { name: "Order summary", exact: true });
  await cart.getByText("Desk Tray", { exact: true }).click();
  await expect(page).toHaveURL(/\/products$/);
  await expect(cart.getByRole("link", { name: "Desk Tray" })).toHaveCount(0);
  await page.goto("/products/SW-105");
  await expect(
    page.getByRole("heading", { name: "Desk Tray", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText("4 left", { exact: true })).toBeVisible();
  await expect(page.getByText("1 in draft")).toBeVisible();
  await page.getByRole("button", { name: "Add Desk Tray" }).click();
  await page.getByRole("link", { name: "Cart 2" }).click();
  await expect(page.getByRole("button", { name: "Place order" })).toBeEnabled();

  const response = await request.get("/api/products");
  const products = await response.json();
  const tray = products.find(
    (product: { name: string }) => product.name === "Desk Tray",
  );
  const competingOrder = await request.post("/api/orders", {
    data: { items: [{ productId: tray.id, quantity: tray.stock - 1 }] },
  });
  expect(competingOrder.status()).toBe(201);

  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Desk Tray has 1 available",
  );
  await expect(page.getByText("Requested 2 · Available 1")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Place order" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Reduce to 1" }).click();
  await expect(page.getByRole("button", { name: "Place order" })).toBeEnabled();
});

test("retrying after a committed response is lost returns the original order", async ({
  page,
  request,
}) => {
  await page.goto("/products");
  const catalogue = page.getByRole("region", { name: "Product catalogue" });
  const cart = page.getByRole("region", { name: "Order summary", exact: true });
  for (let i = 0; i < 5; i++)
    await catalogue.getByRole("button", { name: "Add Studio Mug" }).click();
  await expect(page.getByRole("button", { name: "Cart 5" })).toBeDisabled();
  let reference = "";
  await page.route(
    "**/api/orders",
    async (route) => {
      const result = await route.fetch();
      expect(result.status()).toBe(201);
      reference = (await result.json()).reference;
      await route.abort("connectionreset");
    },
    { times: 1 },
  );
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(
    page.getByRole("button", { name: "Retry checkout" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    cart.getByRole("button", { name: "Remove Studio Mug" }),
  ).toBeDisabled();
  await expect(cart.getByText("Out of stock", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Retry checkout" }).click();
  const details = page.getByRole("dialog", { name: "Order confirmation" });
  await expect(
    details.getByRole("heading", { name: "Order confirmed" }),
  ).toBeVisible();
  expect(new URL(page.url()).searchParams.get("order")).toBe(reference);
  await details.getByRole("link", { name: "Go to dashboard" }).click();
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  await expect(details).toBeHidden();
  const orders = await (await request.get("/api/orders?status=Placed")).json();
  expect(
    orders.filter(
      (order: { reference: string }) => order.reference === reference,
    ),
  ).toHaveLength(1);
});

test("dashboard keeps the viewport fixed while the order table scrolls", async ({
  page,
}) => {
  const orders = Array.from({ length: 40 }, (_, index) => ({
    reference: `ORD-${index.toString(16).toUpperCase().padStart(16, "0")}`,
    status: "Placed",
    totalCents: 3250,
    createdAt: "2026-01-02T03:04:05Z",
    units: 1,
  }));
  await page.route("**/api/orders?*", (route) =>
    route.fulfill({ json: orders }),
  );
  await page.route("**/api/orders/counts", (route) =>
    route.fulfill({
      json: { Placed: 140, Packed: 0, Shipped: 0, Cancelled: 0 },
    }),
  );
  await page.goto("/");
  const table = page.getByRole("region", { name: "Order table" });
  const header = table.getByRole("columnheader", { name: "Reference" });
  await expect(
    table
      .getByRole("cell", { name: "Placed", exact: true })
      .first()
      .getByText("Placed"),
  ).toHaveCSS("color", "rgb(38, 75, 155)");

  const counts = page.getByRole("region", { name: "Order count" });
  const overview = page.getByRole("region", { name: "Fulfilment overview" });
  await expect(overview.getByRole("heading")).toHaveCount(0);
  await expect(overview.getByRole("button")).toHaveCount(4);
  const toPack = overview.getByRole("button", { name: /To pack 140/ });
  await expect(toPack).toHaveAccessibleDescription("140 of 140 total orders");
  await expect(toPack.locator(".circular-progress")).toHaveCSS(
    "--ring-fill",
    "100%",
  );
  await expect(
    overview
      .getByRole("button", { name: /Ready to ship 0/ })
      .locator(".circular-progress"),
  ).toHaveCSS("--ring-fill", "0%");
  const browse = page.getByRole("link", {
    name: "Browse products",
    exact: true,
  });
  const idleLabel = browse.locator(".interactive-hover-idle");
  const activeLabel = browse.locator(".interactive-hover-active");
  const fill = browse.locator(".interactive-hover-fill");
  await expect(activeLabel).toHaveCSS("opacity", "0");
  await browse.hover();
  await expect(fill).toHaveCSS("clip-path", "circle(150% at 15px 50%)");
  await expect(fill).toHaveCSS("background-color", "rgb(23, 23, 23)");
  await expect(idleLabel).toHaveCSS("opacity", "0");
  await expect(activeLabel).toHaveCSS("opacity", "1");
  const search = page.getByRole("textbox", {
    name: "Search by order reference",
  });

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 720 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(table.getByRole("row")).toHaveCount(41);
    await page
      .getByRole("main")
      .evaluate((element) =>
        Promise.all(
          element.getAnimations().map((animation) => animation.finished),
        ),
      );
    const before = await header.boundingBox();
    expect(before).toBeTruthy();
    await expect(
      overview.getByRole("button", { name: /To pack 140/ }),
    ).toBeInViewport();
    await expect(
      counts.getByText("40 orders", { exact: true }),
    ).toBeInViewport();
    const overviewBounds = await overview.boundingBox();
    expect(
      (overviewBounds?.y ?? 0) + (overviewBounds?.height ?? 0),
    ).toBeLessThan(before?.y ?? 0);
    const dockBefore = await counts.boundingBox();
    await table.hover();
    await page.mouse.wheel(0, 650);
    await expect
      .poll(() => table.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(100);
    const after = await header.boundingBox();
    expect(after?.y).toBeCloseTo(before?.y ?? 0, 0);
    await expect(search).toBeInViewport();
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight),
    ).toBeLessThanOrEqual(viewport.height);
    const dockAfter = await counts.boundingBox();
    expect(dockAfter?.y).toBeCloseTo(dockBefore?.y ?? 0, 0);
    await table.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    const lastRow = await table.getByRole("row").last().boundingBox();
    expect((lastRow?.y ?? 0) + (lastRow?.height ?? 0)).toBeLessThanOrEqual(
      (dockAfter?.y ?? 0) + 1,
    );
    const bounds = await table.boundingBox();
    expect((bounds?.y ?? 0) + (bounds?.height ?? 0)).toBeLessThan(
      viewport.height,
    );
    await table.evaluate((element) => {
      element.scrollTop = 0;
    });
  }
});

test("cart shortcut reaches the cart below the catalogue on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 720 });
  await page.goto("/products");
  const catalogue = page.getByRole("region", { name: "Product catalogue" });
  await catalogue.getByRole("button", { name: "Add Field Notebook" }).click();
  await expect(page).toHaveURL(/\/products$/);
  const disabledCart = page.getByRole("button", { name: "Cart 1" });
  await expect(disabledCart).toBeDisabled();
  await disabledCart.hover();
  await expect(page.getByRole("link", { name: "View cart" })).toHaveCount(0);
  await disabledCart.click({ force: true });
  await expect(page).toHaveURL(/\/products$/);
  await page.getByRole("link", { name: "Jump to cart" }).click();
  await expect(page).toHaveURL(/\/products#draft-cart$/);
  const cart = page.getByRole("region", { name: "Order summary", exact: true });
  await expect(cart).toBeFocused();
  await expect(
    cart.getByRole("button", { name: "Place order" }),
  ).toBeInViewport();
  await expect(cart.getByText("Field Notebook", { exact: true })).toBeVisible();
});

test("catalogue spotlight and add ripple respond to reduced motion", async ({
  page,
}) => {
  await page.goto("/products");
  const card = page.getByRole("article").filter({ hasText: "Field Notebook" });
  const add = card.getByRole("button", { name: "Add Field Notebook" });

  await card.hover();
  await expect
    .poll(() =>
      card.evaluate((element) => getComputedStyle(element, "::before").opacity),
    )
    .toBe("1");
  await expect(add.locator(".interactive-hover-fill")).toHaveCount(0);
  await add.click();
  const ripple = add.locator(".button-ripple");
  await expect(ripple).toHaveCSS("animation-name", "button-ripple-out");
  await expect(ripple).toHaveCount(0);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect
    .poll(() =>
      card.evaluate((element) => getComputedStyle(element, "::before").opacity),
    )
    .toBe("0");
  await add.click();
  await expect(
    card.getByRole("status", { name: "Field Notebook quantity" }),
  ).toHaveText("2");
  await expect(ripple).toHaveCount(0);
});

test("new items enter the cart in selection order", async ({ page }) => {
  await page.goto("/products");
  const catalogue = page.getByRole("region", { name: "Product catalogue" });
  const cart = page.getByRole("region", { name: "Order summary", exact: true });
  const notebook = catalogue.getByRole("button", {
    name: "Add Field Notebook",
  });
  await expect(notebook).toHaveCSS("border-top-color", "rgb(23, 23, 23)");
  await expect(notebook).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(notebook).toHaveCSS("border-top-left-radius", "999px");
  const controls = catalogue
    .getByRole("article")
    .filter({ hasText: "Field Notebook" })
    .locator(".draft-controls");
  const before = await controls.evaluate((element: HTMLElement) => [
    element.offsetTop,
    element.offsetLeft,
    element.offsetWidth,
    element.offsetHeight,
  ]);

  await notebook.click();
  await expect(
    controls.getByRole("button", { name: "Decrease Field Notebook quantity" }),
  ).toBeVisible();
  const after = await controls.evaluate((element: HTMLElement) => [
    element.offsetTop,
    element.offsetLeft,
    element.offsetWidth,
    element.offsetHeight,
  ]);
  expect(after).toEqual(before);
  await catalogue.getByRole("button", { name: "Add Everyday Tote" }).click();
  const rows = cart.locator(".cart-lines > li");
  await expect(rows.locator(".product-label strong")).toHaveText([
    "Field Notebook",
    "Everyday Tote",
  ]);
  await expect(rows.last()).toHaveCSS("animation-name", "cart-item-in");
  await expect(
    page.getByRole("button", { name: "Cart 2" }).locator(".cart-trigger-icon"),
  ).toHaveCSS("animation-name", "cart-icon-in");

  await page.reload();
  await expect(rows.locator(".product-label strong")).toHaveText([
    "Field Notebook",
    "Everyday Tote",
  ]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(rows.last()).toHaveCSS("animation-name", "none");
});

test("packing and shipping update the table and timeline in place", async ({
  page,
  request,
}) => {
  const products = await (await request.get("/api/products")).json();
  const notebook = products.find(
    (product: { sku: string }) => product.sku === "SW-103",
  );
  const placement = await request.post("/api/orders", {
    data: { items: [{ productId: notebook.id, quantity: 1 }] },
  });
  expect(placement.status()).toBe(201);
  const { reference } = await placement.json();
  await page.goto("/");
  const table = page.getByRole("region", { name: "Order table" });
  const row = table.getByRole("row").filter({ hasText: reference });
  const pack = row.getByRole("button", { name: "Pack", exact: true });
  await expect(pack).toBeVisible();
  const progressMarkers = row.locator(
    '.order-progress-marker[data-reached="true"]',
  );
  await expect(progressMarkers).toHaveCount(1);
  await page
    .getByRole("main")
    .evaluate((element) =>
      Promise.all(
        element.getAnimations().map((animation) => animation.finished),
      ),
    );
  const before = await table.boundingBox();
  const actionWidth = (await pack.boundingBox())?.width;

  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    `**/api/orders/${reference}/status`,
    async (route) => {
      await gate;
      await route.continue();
    },
    { times: 1 },
  );

  try {
    await pack.click();
    await expect(pack).toHaveAttribute("aria-busy", "true");
    expect((await pack.boundingBox())?.width).toBe(actionWidth);
    expect(await table.boundingBox()).toEqual(before);
    await expect(
      row.getByRole("cell", { name: "Placed", exact: true }),
    ).toBeVisible();
  } finally {
    release();
  }

  await expect(
    row.getByRole("cell", { name: "Packed", exact: true }),
  ).toBeVisible();
  await expect(progressMarkers).toHaveCount(2);
  await expect(page.getByRole("status")).toContainText("marked as packed");
  expect(await table.boundingBox()).toEqual(before);
  await row.getByRole("link", { name: reference }).click();
  const details = page.getByRole("dialog", { name: "Order details" });
  const timeline = details.getByRole("list", { name: "Fulfilment timeline" });
  const steps = timeline.getByRole("listitem");
  await expect(steps.nth(1)).toHaveAttribute("aria-current", "step");
  await details.getByRole("button", { name: "Mark as shipped" }).click();
  await expect(steps.nth(2)).toHaveAttribute("aria-current", "step");
  await expect
    .poll(() =>
      steps
        .nth(1)
        .evaluate((step) => getComputedStyle(step, "::after").transform),
    )
    .toBe("matrix(1, 0, 0, 1, 0, 0)");
  await details.getByRole("button", { name: "Close order details" }).click();
  await expect(
    row.getByRole("cell", { name: "Shipped", exact: true }),
  ).toBeVisible();
  await expect(progressMarkers).toHaveCount(3);
});

test("checkout summary stays pinned while its item list scrolls on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 430 });
  await page.goto("/products");
  const catalogue = page.getByRole("region", { name: "Product catalogue" });
  for (const name of [
    "Field Notebook",
    "Everyday Tote",
    "Desk Tray",
    "Daily Pen Set",
  ]) {
    await catalogue.getByRole("button", { name: `Add ${name}` }).click();
  }
  await page.getByRole("link", { name: "Jump to cart" }).click();
  const cart = page.getByRole("region", { name: "Order summary", exact: true });
  const checkout = cart.getByRole("button", { name: "Place order" });
  await expect(checkout).toBeInViewport();
  const items = cart.locator(".draft-cart-body");
  const before = await checkout.boundingBox();
  await items.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  expect(await items.evaluate((element) => element.scrollTop)).toBeGreaterThan(
    0,
  );
  expect(await checkout.boundingBox()).toEqual(before);
});

test("order list can sort from column headings and remembers the selected sort after reload", async ({
  page,
  request,
}) => {
  const products = await (await request.get("/api/products")).json();
  const notebook = products.find(
    (product: { sku: string }) => product.sku === "SW-103",
  );
  for (const quantity of [1, 2]) {
    const placement = await request.post("/api/orders", {
      data: { items: [{ productId: notebook.id, quantity }] },
    });
    expect(placement.status()).toBe(201);
  }
  const orders = await (await request.get("/api/orders")).json();
  const totals: number[] = orders.map(
    (order: { totalCents: number }) => order.totalCents,
  );
  expect(new Set(totals).size).toBeGreaterThan(1);
  await page.goto("/");
  const sort = page.getByRole("combobox", { name: "Sort by" });
  const table = page.getByRole("region", { name: "Order table" });
  const totalHeading = table.getByRole("columnheader", { name: "Total" });
  const rows = table.locator("tbody tr");
  const totalText = (cents: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(cents / 100);
  await expect(rows).toHaveCount(orders.length);
  await page
    .getByRole("main")
    .evaluate((element) =>
      Promise.all(
        element.getAnimations().map((animation) => animation.finished),
      ),
    );
  const before = await table.boundingBox();
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    "**/api/orders?sort=highest-total",
    async (route) => {
      await gate;
      await route.continue();
    },
    { times: 1 },
  );
  try {
    await totalHeading.getByRole("button").click();
    await expect(sort).toHaveText("Highest total");
    await expect(page).toHaveURL(/sort=highest-total/);
    await expect(rows).toHaveCount(orders.length);
    await expect(
      rows.first().getByRole("cell", {
        name: totalText(Math.max(...totals)),
        exact: true,
      }),
    ).toBeVisible();
    await expect(totalHeading).toHaveAttribute("aria-sort", "descending");
    expect(await table.boundingBox()).toEqual(before);
  } finally {
    release();
  }
  await totalHeading.getByRole("button").click();
  await page.reload();
  await expect(sort).toHaveText("Lowest total");
  await expect(
    rows
      .first()
      .getByRole("cell", { name: totalText(Math.min(...totals)), exact: true }),
  ).toBeVisible();

  const unitsHeading = table.getByRole("columnheader", {
    name: "Units",
    exact: true,
  });
  const unitCounts: number[] = orders.map(
    (order: { units: number }) => order.units,
  );
  const firstUnits = rows.first().getByRole("cell").nth(3);
  await unitsHeading.getByRole("button").click();
  await expect(sort).toHaveText("Most units");
  await expect(unitsHeading).toHaveAttribute("aria-sort", "descending");
  await expect(firstUnits).toHaveText(String(Math.max(...unitCounts)));
  await unitsHeading.getByRole("button").click();
  await expect(sort).toHaveText("Fewest units");
  await expect(unitsHeading).toHaveAttribute("aria-sort", "ascending");
  await expect(firstUnits).toHaveText(String(Math.min(...unitCounts)));

  const placedHeading = table.getByRole("columnheader", {
    name: "Placed",
    exact: true,
  });
  const dates: string[] = orders
    .map((order: { createdAt: string }) => order.createdAt)
    .sort();
  const firstDate = rows.first().locator("time");
  await placedHeading.getByRole("button").click();
  await expect(sort).toHaveText("Newest first");
  await expect(firstDate).toHaveAttribute("datetime", dates.at(-1) ?? "");
  await placedHeading.getByRole("button").click();
  await expect(sort).toHaveText("Oldest first");
  await expect(firstDate).toHaveAttribute("datetime", dates[0] ?? "");
});

test("order filters use highlight styling and retain keyboard selection", async ({
  page,
}) => {
  await page.goto("/");
  const status = page.getByRole("combobox", { name: "Status" });
  const sort = page.getByRole("combobox", { name: "Sort by" });
  const position = (control: Locator) =>
    control.evaluate((element: HTMLElement) => [
      element.offsetLeft,
      element.offsetTop,
    ]);
  const before = await Promise.all([position(status), position(sort)]);
  await status.click();
  const packed = page.getByRole("option", { name: "Ready to ship" });
  await packed.hover();
  await expect(packed).toHaveCSS("outline-style", "none");
  await expect(packed).toHaveCSS("background-color", "rgb(238, 238, 238)");
  await packed.click();
  await expect(status).toHaveText("Ready to ship");
  const clear = page.getByRole("button", { name: "Clear status filter" });
  await expect(clear).toBeVisible();
  expect(await Promise.all([position(status), position(sort)])).toEqual(before);
  await expect(status).toHaveCSS("outline-style", "none");
  await expect(status).toHaveCSS("box-shadow", "none");

  await page.keyboard.press("Tab");
  await expect(clear).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(sort).toBeFocused();
  await expect(sort).not.toHaveCSS("box-shadow", "none");
  await sort.press("Space");
  await expect(
    page.getByRole("option", { name: "Default (oldest first)" }),
  ).toBeFocused();
  await page.keyboard.press("End");
  await expect(
    page.getByRole("option", { name: "Fewest units" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(sort).toHaveText("Fewest units");
  await expect(page).toHaveURL(/status=Packed.*sort=fewest-units/);
});
