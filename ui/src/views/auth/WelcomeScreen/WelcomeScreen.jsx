import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from 'react-bootstrap';
// import authlogdark from 'assets/images/auth/auth-logo-dark.png';
import cyfastLogo from 'assets/images/auth/cyfast_logo.png';
// import cyientLogoWhite from 'assets/images/auth/cyient_logo_white.jpg';

import bgImage from 'assets/images/bg-images/bg1.jpg';
import './WelcomeScreen.css';

const WelcomeScreen = () => {
  const navigate = useNavigate();

  return (
    <div className="welcome-container" style={{ backgroundImage: `url(${bgImage})` }}>
      <div className="logo-container">
        <img src={cyfastLogo} alt="CyFAST Logo" className="right-logo" />
      </div>

      <div className="top-right-buttons">
        <Button variant="outline-primary" className="signin-button mx-2" onClick={() => navigate('/login')}>
          SIGN IN
        </Button>
      </div>

      <div className="bottom-text">
        <h1>CYIENT&apos;S FRAMEWORK FOR AUTOMATION</h1>
        <h1>OF SOFTWARE AND SYSTEM TESTING</h1>
        <h4>Get started in no time, scale up with no limit, for any team, at any level</h4>
      </div>
    </div>
  );
};

export default WelcomeScreen;
