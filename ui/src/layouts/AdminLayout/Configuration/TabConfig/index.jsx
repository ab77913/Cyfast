import React from 'react';

// project import
import LayoutOptions from './LayoutOptions';
import ColorOptions from './ColorOptions';

// ==============================|| TAB CONFIG ||============================== //

const TabConfig = () => {
  return (
    <React.Fragment>
      <ColorOptions />
      <LayoutOptions />
    </React.Fragment>
  );
};

export default TabConfig;
