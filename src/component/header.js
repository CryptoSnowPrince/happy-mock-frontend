import React from "react";

const Header = ({ isConnected, pendingTx, logoutOfWeb3Modal, loadWeb3Modal, connButtonText }) => {
    const isMobile = window.matchMedia("only screen and (max-width: 1000px)").matches;

    return (
        <>
            <nav className="navbar navbar-expand-sm navbar-dark custom-navbar" >
                <div className="container"
                    style={{
                        justifyContent: isMobile ? 'space-around' : 'space-between',
                        flexDirection: isMobile ? 'column' : 'row'
                    }}>
                    <div className="title title-text">
                        BEAUTY
                    </div>
                    <button className="btn btn-primary btn-lg btnd btn-custom"
                        style={{ color: "#fff", width: "155px", fontWeight: "bold" }}
                        disabled={pendingTx}
                        onClick={isConnected ? logoutOfWeb3Modal : loadWeb3Modal}>
                        <i className="fas fa-wallet" style={{ marginRight: "12px", color: "white" }}>
                        </i>
                        {connButtonText}
                    </button>
                </div>
            </nav>
            <div className="subtitle-text">
                THIS IS MOCK FRONTEND
            </div>
            <br />
        </>
    );
}

export default Header;
