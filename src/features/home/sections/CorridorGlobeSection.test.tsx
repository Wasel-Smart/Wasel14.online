import { act, render, waitFor } from '@testing-library/react';
import { CorridorGlobeSection } from './CorridorGlobeSection';

vi.mock('./CorridorGlobeScene', () => ({ default: () => null }));

describe('CorridorGlobeSection', () => {
  it('waits until the section approaches the viewport before initializing WebGL', async () => {
    const callbacks: IntersectionObserverCallback[] = [];
    class MockIntersectionObserver {
      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
      root = null;
      rootMargin: string;
      thresholds: number[] = [];

      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        callbacks.push(callback);
        this.rootMargin = options?.rootMargin ?? '0px';
      }

      takeRecords(): IntersectionObserverEntry[] { return []; }
    }

    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
    vi.stubGlobal('WebGLRenderingContext', class {});
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as GPUCanvasContext);
    const { container, unmount } = render(<CorridorGlobeSection ar={false} />);

    expect(container.querySelector('section')).not.toBeNull();
    expect(getContext).not.toHaveBeenCalled();
    expect(callbacks).toHaveLength(1);

    const onIntersection = callbacks[0];
    if (!onIntersection) {throw new Error('Intersection observer was not registered');}
    act(() => onIntersection([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    await waitFor(() => expect(getContext).toHaveBeenCalledWith('webgl2'));

    unmount();
    getContext.mockRestore();
    vi.unstubAllGlobals();
  });
});
