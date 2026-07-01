import { computed, onBeforeUnmount, ref } from 'vue';

export type ResizeDirection = 'horizontal' | 'vertical' | 'both';

export interface UseResizableOptions {
  key: string;
  defaultWidth?: number;
  defaultHeight?: number;
  direction: ResizeDirection;
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

  function onMouseMove(event: MouseEvent) {
    if (!isResizing.value) return;

    if (options.direction === 'horizontal' || options.direction === 'both') {
      width.value = clamp(startWidth + event.clientX - startX, 0, viewportWidthLimit());
    }

    if (options.direction === 'vertical' || options.direction === 'both') {
      const deltaY = event.clientY - startY;
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
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', stopResize);
    persistAndNotify();
  }

  function startResize(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    isResizing.value = true;
    startX = event.clientX;
    startY = event.clientY;
    startWidth = width.value;
    startHeight = height.value;
    previousCursor = document.body.style.cursor;
    previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = cursor.value;
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', stopResize);
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
