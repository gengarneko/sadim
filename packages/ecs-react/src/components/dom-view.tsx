import React from 'react';

import { EntityContext } from '../hooks';
import { useMount } from 'ahooks';

export interface DOMViewProps {
  children: React.ReactElement;
}

export interface DOMViewRef {
  element: HTMLElement;
}

export interface DOMViewState {
  styles: {
    top: number;
    left: number;
    width: number;
    height: number;
    position: 'absolute' | 'relative';
  }
}

/**
* 包装 DOM 元素并提供对其的引用
* 与 Entity 系统集成（通过 context）
* 强制要求只有一个子元素
* 提供对 DOM 元素的直接访问
*/
const DOMViewComponent: React.ForwardRefRenderFunction<DOMViewRef, DOMViewProps> = (
  props,
  ref
) => {
  const elementRef = React.useRef<HTMLElement>(null);
  const entity = React.useContext(EntityContext);

  // 暴露 element 给父组件
  React.useImperativeHandle(ref, () => ({
    get element() {
      return elementRef.current!;
    }
  }), [elementRef]);

  useMount(() => entity && entity.add(elementRef.current!))

  // 检查子元素数量
  if (React.Children.count(props.children) !== 1) {
    throw new Error('<DOMView /> must have a single child.');
  }

  return React.cloneElement(props.children, {
    ref: elementRef
  });
}
export const DOMView = React.forwardRef<DOMViewRef, DOMViewProps>(DOMViewComponent);

(DOMView as any).__componentClassId__ = -1;
