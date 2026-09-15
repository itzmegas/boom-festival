export interface Disposable {
  dispose(): void;
}

export interface DisposalRegistry {
  track<T extends Disposable>(resource: T): T;
  dispose(): void;
}

export interface FrameScheduler {
  request(callback: FrameRequestCallback): number;
  cancel(handle: number): void;
}

export interface RenderInvalidator {
  invalidate(): void;
  dispose(): void;
}

export function createDisposalRegistry(): DisposalRegistry {
  const resources = new Set<Disposable>();
  return {
    track(resource) {
      resources.add(resource);
      return resource;
    },
    dispose() {
      for (const resource of resources) {
        resource.dispose();
      }
      resources.clear();
    },
  };
}

export function createRenderInvalidator(
  render: () => void,
  scheduler: FrameScheduler = {
    request: (callback) => window.requestAnimationFrame(callback),
    cancel: (handle) => window.cancelAnimationFrame(handle),
  },
): RenderInvalidator {
  let pendingFrame: number | undefined;
  let disposed = false;

  return {
    invalidate() {
      if (disposed || pendingFrame !== undefined) {
        return;
      }
      pendingFrame = scheduler.request(() => {
        pendingFrame = undefined;
        render();
      });
    },
    dispose() {
      disposed = true;
      if (pendingFrame !== undefined) {
        scheduler.cancel(pendingFrame);
        pendingFrame = undefined;
      }
    },
  };
}
