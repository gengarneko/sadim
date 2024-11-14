import React from 'react';

import {Leva} from 'leva';

import {Codeblock} from './codeblock';

export interface LayoutProps {
  children: React.ReactNode;

  /** Whether to hide the controls panel */
  hideControls?: boolean;

  /** Whether to collapse the controls panel */
  collapsed?: boolean;

  /** The code to display */
  code?: string;
}

/**
 * Layout component with Leva controls and code block
 */
export function Layout(props: LayoutProps) {
  const {children, hideControls, collapsed = false, code} = props;
  return (
    <div className='flex items-stretch flex-col flex-1'>
      {/* Leva controls */}
      <div
        className='absolute top-[75px] right-[10px] z-10 w-[300px]'
        style={{
          display: hideControls ? 'none' : 'block',
        }}
      >
        <Leva fill collapsed={collapsed} />
      </div>

      {/* Children */}
      <div className='flex flex-col border'>
        <React.Suspense fallback={<div />}>{children}</React.Suspense>
      </div>

      {/* Code block */}
      {code && <Codeblock code={code} />}
    </div>
  );
}
