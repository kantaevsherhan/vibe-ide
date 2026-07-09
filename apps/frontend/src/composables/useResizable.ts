import { computed, onBeforeUnmount, ref } from 'vue';

export type ResizeDirection = 'horizontal' | 'vertical' | 'both';

export interface UseResizableOptions {
  key: string;
  defaultWidth?: number;
  defaultHeight?: number;
  direction: ResizeDirection;
  horizontalGrowthDirection?: 'right' | 'left';
  verticalGrowthDirection?: 'down' | 'up';
}

type StoredSize = {
  width?: number;
  height?: number;
};

const resizeEventName = 'vibeide:resize';

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function viewportWidthLimit() {
  return Math.max(0, window.innerWidth - 64);
}

function viewportHeightLimit() {
  return Math.max(0, window.innerHeight - 64);
}

function readStoredSize(key: string): StoredSize {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as StoredSize) : {};
  } catch {
    return {};
  }
}

function saveStoredSize(key: string, size: StoredSize) {
  localStorage.setItem(key, JSON.stringify(size));
}

export function useResizable(options: UseResizableOptions) {
  const storedSize = readStoredSize(options.key);
  const width = ref(clamp(storedSize.width ?? options.defaultWidth ?? 0, 0, viewportWidthLimit()));
  const height = ref(clamp(storedSize.height ?? options.defaultHeight ?? 0, 0, viewportHeightLimit()));
  const isResizing = ref(false);

  let startX = 0;
  let startY = 0;
  let startWidth = 0;
  let startHeight = 0;
  let previousCursor = '';
  let previousUserSelect = '';

  const cursor = computed(() => {
    if (options.direction === 'horizontal') return 'col-resize';
    if (options.direction === 'vertical') return 'row-resize';
    return 'nwse-resize';
  });

  const style = computed(() => ({
    width: width.value ? `${width.value}px` : undefined,
    height: height.value ? `${height.value}px` : undefined
  }));

  function persistAndNotify() {
    saveStoredSize(options.key, {
      width: options.direction !== 'vertical' ? width.value : undefined,
      height: options.direction !== 'horizontal' ? height.value : undefined
    });
    window.dispatchEvent(new CustomEvent(resizeEventName));
  }

  function eventPoint(event: MouseEvent | TouchEvent | PointerEvent) {
    if ('touches' in event) {
      const touch = event.touches[0] ?? event.changedTouches[0];
      return { clientX: touch?.clientX ?? startX, clientY: touch?.clientY ?? startY };
    }

    return { clientX: event.clientX, clientY: event.clientY };
  }

  function onResizeMove(event: MouseEvent | TouchEvent | PointerEvent) {
    if (!isResizing.value) return;
    event.preventDefault();
    const point = eventPoint(event);

    if (options.direction === 'horizontal' || options.direction === 'both') {
      const deltaX = point.clientX - startX;
      const nextWidth = options.horizontalGrowthDirection === 'left' ? startWidth - deltaX : startWidth + deltaX;
      width.value = clamp(nextWidth, 0, viewportWidthLimit());
    }

    if (options.direction === 'vertical' || options.direction === 'both') {
      const deltaY = point.clientY - startY;
      const nextHeight = options.verticalGrowthDirection === 'up' ? startHeight - deltaY : startHeight + deltaY;
      height.value = clamp(nextHeight, 0, viewportHeightLimit());
    }

    persistAndNotify();
  }

  function stopResize() {
    if (!isResizing.value) return;

    isResizing.value = false;
    document.body.style.cursor = previousCursor;
    document.body.style.userSelect = previousUserSelect;
    document.removeEventListener('mousemove', onResizeMove);
    document.removeEventListener('mouseup', stopResize);
    document.removeEventListener('touchmove', onResizeMove);
    document.removeEventListener('touchend', stopResize);
    document.removeEventListener('pointermove', onResizeMove);
    document.removeEventListener('pointerup', stopResize);
    persistAndNotify();
  }

  function startResize(event: MouseEvent | TouchEvent | PointerEvent) {
    event.preventDefault();
    event.stopPropagation();
    const point = eventPoint(event);
    isResizing.value = true;
    startX = point.clientX;
    startY = point.clientY;
    startWidth = width.value;
    startHeight = height.value;
    previousCursor = document.body.style.cursor;
    previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = cursor.value;
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onResizeMove);
    document.addEventListener('mouseup', stopResize);
    document.addEventListener('touchmove', onResizeMove, { passive: false });
    document.addEventListener('touchend', stopResize);
    document.addEventListener('pointermove', onResizeMove);
    document.addEventListener('pointerup', stopResize);
  }

  onBeforeUnmount(stopResize);

  return {
    width,
    height,
    style,
    isResizing,
    startResize
  };
}

export { resizeEventName };
