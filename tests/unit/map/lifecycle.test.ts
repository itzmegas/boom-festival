import { describe, expect, it, vi } from "vitest";
import { createDisposalRegistry, createRenderInvalidator } from "../../../src/scripts/map/lifecycle";
import { dispatchPoiSelect, listenForPoiSelect } from "../../../src/scripts/map/selection";

describe("map selection contract", () => {
  it("dispatches typed poi:select details and aborts listeners", () => {
    const target = new EventTarget();
    const controller = new AbortController();
    const selections: Array<string | null> = [];
    listenForPoiSelect(target, (slug) => selections.push(slug), controller.signal);

    dispatchPoiSelect(target, "kosmicare");
    dispatchPoiSelect(target, null);
    controller.abort();
    dispatchPoiSelect(target, "ignored");

    expect(selections).toEqual(["kosmicare", null]);
  });
});

describe("render invalidation and cleanup", () => {
  it("coalesces invalidations instead of creating a continuous loop", () => {
    let scheduled: FrameRequestCallback | undefined;
    const render = vi.fn();
    const invalidator = createRenderInvalidator(render, {
      request: (callback) => {
        scheduled = callback;
        return 7;
      },
      cancel: vi.fn(),
    });

    invalidator.invalidate();
    invalidator.invalidate();
    expect(render).not.toHaveBeenCalled();

    scheduled?.(0);
    expect(render).toHaveBeenCalledTimes(1);
  });

  it("disposes tracked resources once and cancels pending rendering", () => {
    const dispose = vi.fn();
    const cancel = vi.fn();
    const registry = createDisposalRegistry();
    const resource = { dispose };
    registry.track(resource);
    registry.track(resource);

    const invalidator = createRenderInvalidator(vi.fn(), {
      request: () => 11,
      cancel,
    });
    invalidator.invalidate();
    invalidator.dispose();
    registry.dispose();
    registry.dispose();

    expect(cancel).toHaveBeenCalledWith(11);
    expect(dispose).toHaveBeenCalledTimes(1);
  });
});
