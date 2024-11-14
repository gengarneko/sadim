import {useState} from 'react';

import './index.css';

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className='w-screen h-screen bg-[#242424]'>
      <div className='w-full h-full flex flex-col items-center justify-center'>
        <div className='text-white'>count: {count}</div>
        <button
          className='bg-white text-black p-2 rounded-md'
          onClick={() => setCount((count) => count + 1)}
        >
          Click me
        </button>
      </div>
    </div>
  );
}

export default App;
