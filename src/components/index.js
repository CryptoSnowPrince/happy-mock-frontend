import { useCallback, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { ToastContainer, toast } from 'react-toastify';
import web3ModalSetup from "./../helpers/web3ModalSetup";
import Web3 from "web3";
import {
  getAbi,
  getTokenAbi,
  REFERRAL_PERCENT,
  WITHDRAW_FEE,
  DENOMINATOR_PERCENT,
  DECIMALS,
  EPOCH_LENGTH,
  Beauty,
  START_TIME,
  RPC_URL,
  MAINNET,
  ADMIN_ACCOUNT,
  TREASURY,
  WITHDRAW_TIME,
  ALERT_DELAY,
  ALERT_POSITION,
  ALERT_EMPTY,
  ALERT_SUCCESS,
  ALERT_WARN,
  ALERT_ERROR,
} from "../Abi";
import * as action from '../store/actions'
import * as selector from '../store/selectors'

const web3Modal = web3ModalSetup();

const httpProvider = new Web3.providers.HttpProvider(RPC_URL)
const web3NoAccount = new Web3(httpProvider)
const isAddress = web3NoAccount.utils.isAddress
const tokenAbiNoAccount = getTokenAbi(web3NoAccount)
const AbiNoAccount = getAbi(web3NoAccount)

const displayRemainTime = (seconds) => {
  if (seconds > 0) {
    // Calculating the days, hours, minutes and seconds left
    const timeDays = Math.floor(seconds / (60 * 60 * 24))
    const timeHours = Math.floor((seconds % (60 * 60 * 24)) / (60 * 60))
    const timeMinutes = Math.floor((seconds % (60 * 60)) / 60)

    if (timeDays > 0) {
      return `${timeDays}D : ${timeHours}H`
    } else {
      return `${timeHours}H : ${timeMinutes}M`
    }
  }

  return `0H : 0M`
}

const Interface = () => {
  const isMobile = window.matchMedia("only screen and (max-width: 1000px)").matches;

  const [Abi, setAbi] = useState();
  const [tokenAbi, setTokenAbi] = useState();

  const dispatch = useDispatch();

  const web3 = useSelector(selector.web3State)
  const isConnected = useSelector(selector.isConnectedState)
  const injectedProvider = useSelector(selector.injectedProviderState)
  const curAcount = useSelector(selector.curAcountState)

  const [refetch, setRefetch] = useState(true);
  const [connButtonText, setConnButtonText] = useState("CONNECT");

  const [pendingMessage, setPendingMessage] = useState('');
  const [pendingTx, setPendingTx] = useState(false);

  const [depositValue, setDepositValue] = useState('');
  const [withdrawValue, setWithdrawValue] = useState('');
  const [withdrawRequestValue, setWithdrawRequestValue] = useState('');

  const [treasuryAmount, setTreasuryAmount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [curAPY, setCurAPY] = useState('0')
  const [userBalance, setUserBalance] = useState(0);
  const [userApprovedAmount, setUserApprovedAmount] = useState(0);
  const [userDepositedAmount, setUserDepositedAmount] = useState(0);
  const [referralReward, setReferralReward] = useState(0);
  const [refTotalWithdraw, setRefTotalWithdraw] = useState(0);
  const [nextWithdraw, setNextWithdraw] = useState(0);
  const [userInfo, setUserInfo] = useState({});
  const [enabledAmount, setEnabledAmount] = useState(0);
  const [curEpoch, setCurEpoch] = useState(0)

  const [remainTime, setRemainTime] = useState(0)
  const [withdrawState, setWithdrawState] = useState(false)

  const [alertMessage, setAlertMessage] = useState({ type: ALERT_EMPTY, message: "" })

  // const [playing, toggle] = useAudio(music);

  const logoutOfWeb3Modal = async () => {
    web3Modal.clearCachedProvider();
    if (
      injectedProvider &&
      injectedProvider.provider &&
      typeof injectedProvider.provider.disconnect == "function"
    ) {
      await injectedProvider.provider.disconnect();
    }
    dispatch(action.setIsConnected(false))

    window.location.reload();
  };
  const loadWeb3Modal = useCallback(async () => {
    // console.log("Connecting Wallet...");
    const provider = await web3Modal.connect();
    // console.log("provider: ", provider);
    const web3Provider = new Web3(provider);
    dispatch(action.setInjectedProvider(web3Provider));
    var acc = null;
    try {
      // alert("loadWeb3Modal try");
      acc = provider.selectedAddress
        ? provider.selectedAddress
        : provider.accounts[0];
    } catch (error) {
      // alert("loadWeb3Modal catch");
      acc = provider.address
    }

    const _curChainId = await web3Provider.eth.getChainId();
    if (_curChainId !== MAINNET) {
      setAlertMessage({ type: ALERT_ERROR, message: 'Wrong Network! Please switch to Binance Smart Chain!' })
      return;
    }

    const short = shortenAddr(acc);

    dispatch(action.setWeb3(web3Provider))
    dispatch(action.setCurAcount(acc))
    dispatch(action.setIsConnected(true))
    setAbi(getAbi(web3Provider));
    setTokenAbi(getTokenAbi(web3Provider));

    setConnButtonText(short);

    provider.on("chainChanged", (chainId) => {
      console.log(`chain changed to ${chainId}! updating providers`);
      dispatch(action.setInjectedProvider(web3Provider));
      logoutOfWeb3Modal();
    });

    provider.on("accountsChanged", () => {
      console.log(`curAcount changed!`);
      dispatch(action.setInjectedProvider(web3Provider));
      logoutOfWeb3Modal();
    });

    // Subscribe to session disconnection
    provider.on("disconnect", (code, reason) => {
      console.log(code, reason);
      logoutOfWeb3Modal();
    });
    // eslint-disable-next-line
  }, [dispatch]);

  useEffect(() => {
    setInterval(() => {
      setRefetch((prevRefetch) => {
        return !prevRefetch;
      });
    }, 10000);
  }, []);

  const shortenAddr = (addr) => {
    if (!addr) return "";
    const first = addr.substr(0, 5);
    const last = addr.substr(38, 41);
    return first + "..." + last;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const blockTimestamp = (await web3NoAccount.eth.getBlock('latest')).timestamp;
        const curEpochVal = START_TIME > blockTimestamp ? 0 : Math.floor((blockTimestamp - START_TIME) / EPOCH_LENGTH + 1)
        setCurEpoch(curEpochVal)

        const epoch = curEpochVal > 0 ? curEpochVal : 1
        const closeTime = (START_TIME + (epoch - 1) * EPOCH_LENGTH + WITHDRAW_TIME)

        if (blockTimestamp < closeTime && curEpochVal > 1) {
          setRemainTime(closeTime - blockTimestamp)
          setWithdrawState(true)
        } else {
          setWithdrawState(false)
          const openTime = (START_TIME + epoch * EPOCH_LENGTH)
          setRemainTime(openTime - blockTimestamp)
        }

        const totalAmount = await AbiNoAccount.methods.totalAmount().call();
        setTotalAmount(web3NoAccount.utils.fromWei(totalAmount, DECIMALS));

        const treasuryAmount = await tokenAbiNoAccount.methods.balanceOf(TREASURY).call();
        setTreasuryAmount(web3NoAccount.utils.fromWei(treasuryAmount, DECIMALS));

        const epochNumberVal = await AbiNoAccount.methods.epochNumber().call();
        const curAPYVal = await AbiNoAccount.methods.apy(epochNumberVal).call();
        setCurAPY(curAPYVal)

        if (curAcount) {
        }

        if (isConnected && Abi && curAcount) {
          // console.log(curAcount);

          const userBalance = await tokenAbi.methods.balanceOf(curAcount).call();
          setUserBalance(web3NoAccount.utils.fromWei(userBalance, DECIMALS));

          const approvedAmount = await tokenAbi.methods.allowance(curAcount, Beauty).call();
          setUserApprovedAmount(web3NoAccount.utils.fromWei(approvedAmount, DECIMALS));


          const nextWithdraw = await Abi.methods.getPendingReward(curAcount).call();
          setNextWithdraw(web3NoAccount.utils.fromWei(nextWithdraw, DECIMALS))

          const refEarnedWithdraw = await Abi.methods.referralRewards(curAcount).call();
          setReferralReward(web3NoAccount.utils.fromWei(refEarnedWithdraw, DECIMALS));

          const refTotalWithdraw = await Abi.methods.referralTotalRewards(curAcount).call();
          setRefTotalWithdraw(web3NoAccount.utils.fromWei(refTotalWithdraw, DECIMALS));

          const userInfo = await Abi.methods.userInfo(curAcount).call();
          console.log("[PRINCE](userInfo): ", userInfo)
          setUserInfo(userInfo)

          const userDepositedAmount = await Abi.methods.amount(curAcount, parseInt(userInfo[3])).call();
          setUserDepositedAmount(web3NoAccount.utils.fromWei(userDepositedAmount, DECIMALS));

          const enabledAmount = parseInt(userInfo[1]) > 0 ? (await Abi.methods.amount(curAcount, parseInt(userInfo[1]) - 1).call()) : "0"
          setEnabledAmount(web3NoAccount.utils.fromWei(enabledAmount, DECIMALS))
        }

        // const owner = await Abi.methods.owner().call();

        // console.log('Owner: ', owner);
      } catch (error) {
        console.log('fetchData error: ', error);
      }
    };

    fetchData();
  }, [isConnected, web3, Abi, tokenAbi, refetch, curAcount]);

  // buttons

  const ClaimNow = async (e) => {
    try {
      e.preventDefault();
      if (pendingTx) {
        setPendingMessage("Pending...")
        return
      }

      if (nextWithdraw <= 0) {
        setPendingMessage("No Next Rewards!")
        return
      }

      setPendingTx(true)
      if (isConnected && Abi) {
        //  console.log("success")
        setPendingMessage("Claiming...")
        Abi.methods.withdraw("0").send({
          from: curAcount,
        }).then((txHash) => {
          console.log(txHash)
          const txHashString = `${txHash.transactionHash}`
          const msgString = txHashString.substring(0, 8) + "..." + txHashString.substring(txHashString.length - 6)
          setPendingMessage(`Claimed Successfully! txHash is ${msgString}`);
        }).catch((err) => {
          console.log(err)
          setPendingMessage(`Claim Failed because ${err.message}`);
        });

      } else {
        // console.log("connect wallet");
      }
      setPendingTx(false)
    } catch (error) {
      setPendingTx(false)
    }
  };

  const refWithdraw = async (e) => {
    try {
      e.preventDefault();
      if (pendingTx) {
        setPendingMessage("Pending...")
        return
      }

      if (referralReward <= 0) {
        setPendingMessage("No Next Referral Rewards!")
        return
      }

      setPendingTx(true)
      if (isConnected && Abi) {
        //  console.log("success")
        setPendingMessage("Referral Rewards withdrawing...")
        await Abi.methods.withdrawReferral().send({
          from: curAcount,
        }).then((txHash) => {
          console.log(txHash)
          const txHashString = `${txHash.transactionHash}`
          const msgString = txHashString.substring(0, 8) + "..." + txHashString.substring(txHashString.length - 6)
          setPendingMessage(`Withdraw Successfully! txHash is ${msgString}`);
        }).catch((err) => {
          console.log(err)
          setPendingMessage(`Withdraw Failed because ${err.message}`);
        });

      } else {
        // console.log("connect wallet");
      }
      setPendingTx(false)
    } catch (error) {
      setPendingTx(false)
    }
  };

  const closeBar = async (e) => {
    e.preventDefault();
    setPendingMessage('');
  }

  const deposit = async (e) => {
    try {
      e.preventDefault();
      if (pendingTx) {
        setPendingMessage("Pending...")
        return
      }

      if (Number.isNaN(parseFloat(depositValue))) {
        setPendingMessage("Input Deposit Amount!")
        return
      }

      if (parseFloat(depositValue) > userBalance) {
        setPendingMessage("Deposit amount must be equal or less than your wallet balance!")
        return
      }

      if (parseFloat(depositValue) < 0) {
        setPendingMessage("Deposit amount must be equal or greater than 0 BUSD!")
        return
      }

      setPendingTx(true)
      if (isConnected && Abi) {
        // console.log("success")

        setPendingMessage("Depositing...")
        const _value = web3NoAccount.utils.toWei(depositValue, DECIMALS);
        console.log("[PRINCE](deposit): ", _value)

        let referrer = window.localStorage.getItem("REFERRAL");
        referrer = isAddress(referrer, MAINNET) ? referrer : ADMIN_ACCOUNT

        await Abi.methods.deposit(_value, referrer).send({
          from: curAcount
        }).then((txHash) => {
          console.log(txHash)
          const txHashString = `${txHash.transactionHash}`
          const msgString = txHashString.substring(0, 8) + "..." + txHashString.substring(txHashString.length - 6)
          setPendingMessage(`Deposited Successfully! txHash is ${msgString}`);
        }).catch((err) => {
          console.log(err)
          setPendingMessage(`Deposited Failed because ${err.message}`);
        });
      }
      else {
        // console.log("connect wallet");
      }
      setPendingTx(false)
    } catch (error) {
      setPendingTx(false)
    }
  };

  const unStake = async (e) => {
    try {
      e.preventDefault();
      if (pendingTx) {
        setPendingMessage("Pending...")
        return
      }

      if (Number.isNaN(parseFloat(withdrawValue))) {
        setPendingMessage("Input Withdraw Amount!")
        return
      }

      if (parseFloat(withdrawValue) > userDepositedAmount) {
        setPendingMessage("Withdraw amount must be less than your deposited amount!")
        return
      }

      setPendingTx(true)
      if (isConnected && Abi) {
        setPendingMessage("Unstaking...");
        const _withdrawValue = web3NoAccount.utils.toWei(withdrawValue, DECIMALS);
        console.log("[PRINCE](withdraw): ", _withdrawValue)
        await Abi.methods.withdraw(_withdrawValue).send({
          from: curAcount,
        }).then((txHash) => {
          console.log(txHash)
          const txHashString = `${txHash.transactionHash}`
          const msgString = txHashString.substring(0, 8) + "..." + txHashString.substring(txHashString.length - 6)
          setPendingMessage(`UnStaked Successfully! txHash is ${msgString}`);
        }).catch((err) => {
          console.log(err)
          setPendingMessage(`UnStaked Failed because ${err.message}`);
        });
      }
      else {
        // console.log("connect Wallet");
      }
      setPendingTx(false)
    } catch (error) {
      setPendingTx(false)
    }
  };

  const withdrawRequest = async (e) => {
    try {
      e.preventDefault();
      if (pendingTx) {
        setPendingMessage("Pending...")
        return
      }

      if (Number.isNaN(parseFloat(withdrawRequestValue))) {
        setPendingMessage("Input Request Amount!")
        return
      }

      setPendingTx(true)
      if (isConnected && Abi) {
        setPendingMessage("Requesting...");
        const _withdrawRequestValue = web3NoAccount.utils.toWei(withdrawRequestValue, DECIMALS);
        console.log("[PRINCE](withdrawRequest): ", _withdrawRequestValue)
        await Abi.methods.withdrawRequest(_withdrawRequestValue).send({
          from: curAcount,
        }).then((txHash) => {
          console.log(txHash)
          const txHashString = `${txHash.transactionHash}`
          const msgString = txHashString.substring(0, 8) + "..." + txHashString.substring(txHashString.length - 6)
          setPendingMessage(`Requested Successfully! txHash is ${msgString}`);
        }).catch((err) => {
          console.log(err)
          setPendingMessage(`Requested Failed because ${err.message}`);
        });
      }
      else {
        // console.log("connect Wallet");
      }
      setPendingTx(false)
    } catch (error) {
      setPendingTx(false)
    }
  };

  const approve = async (e) => {
    try {
      console.log("[PRINCE](approve): ")
      e.preventDefault();
      if (pendingTx) {
        setPendingMessage("Pending...")
        return
      }

      setPendingTx(true)
      if (isConnected && tokenAbi) {
        setPendingMessage("Approving...");

        await tokenAbi.methods.approve(Beauty, "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff").send({
          from: curAcount
        }).then((txHash) => {
          console.log(txHash)
          const txHashString = `${txHash.transactionHash}`
          const msgString = txHashString.substring(0, 8) + "..." + txHashString.substring(txHashString.length - 6)
          setPendingMessage(`Approved Successfully! txHash is ${msgString}`);
        }).catch((err) => {
          console.log(err)
          setPendingMessage(`Approved Failed because ${err.message}`);
        });
      } else {
        console.error("connect Wallet");
      }
      setPendingTx(false)
    } catch (error) {
      setPendingTx(false)
    }
  };

  const handleClose = useCallback(() => {
    setAlertMessage({ type: ALERT_EMPTY, message: "" })
  }, [setAlertMessage])

  const notifySuccess = useCallback(() => {
    toast.success(alertMessage.message, {
      position: ALERT_POSITION,
      autoClose: ALERT_DELAY,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      onClose: handleClose,
      className: 'alert-message-success'
    });
  }, [alertMessage.message, handleClose]);

  const notifyError = useCallback(() => {
    toast.error(alertMessage.message, {
      position: ALERT_POSITION,
      autoClose: ALERT_DELAY,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      onClose: handleClose,
      className: 'alert-message-error'
    });
  }, [alertMessage.message, handleClose]);

  const notifyWarn = useCallback(() => {
    toast.warn(alertMessage.message, {
      position: ALERT_POSITION,
      autoClose: ALERT_DELAY,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      onClose: handleClose,
      className: 'alert-message-warn',
      progressClassName: 'alert-message-warn-progress'
    });
  }, [alertMessage.message, handleClose]);

  useEffect(() => {
    switch (alertMessage.type) {
      case ALERT_ERROR:
        notifyError()
        return;
      case ALERT_SUCCESS:
        notifySuccess()
        return;
      case ALERT_WARN:
        notifyWarn()
        return;
      case ALERT_EMPTY:
        return;
      default:
        handleClose();
        return;
    }

  }, [alertMessage, notifyError, notifyWarn, notifySuccess, handleClose])

  return (
    <>
      <ToastContainer />
      <nav className="navbar navbar-expand-sm navbar-dark" style={{ marginTop: "30px" }}>
        <div className="container"
          style={{
            justifyContent: isMobile ? 'space-around' : 'space-between',
            flexDirection: isMobile ? 'column' : 'row'
          }}>
          <div style={{ width: "200px" }}></div>
          {/* <div style={{ width: "200px", height: "140px" }}></div> */}
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
      <div className="container">
        {
          pendingMessage !== '' ?
            <>
              <center>
                <div className="alert alert-warning alert-dismissible" style={{ width: isMobile ? '270px' : '100%' }}>
                  <p onClick={closeBar} className="badge bg-dark" style={{ float: "right", cursor: "pointer" }}>X</p>
                  {pendingMessage}
                </div>
              </center>
            </> : <></>
        }
        <div className="row">
          <div className="col-sm-3">
            <div className="card">
              <div className="card-body">
                <center>
                  <h4 className="subtitle">TREASURY</h4>
                  <h4 className="value-text">{Number(treasuryAmount).toFixed(2)} BUSD</h4>
                </center>
              </div>
            </div>
          </div>
          <div className="col-sm-3">
            <div className="card">
              <div className="card-body">
                <center>
                  <h4 className="subtitle">CURRENT APY</h4>
                  <h4 className="value-text">{curAPY / DENOMINATOR_PERCENT * 12}%</h4>
                </center>
              </div>
            </div>
          </div>
          <div className="col-sm-3">
            <div className="card">
              <div className="card-body">
                <center>
                  <h4 className="subtitle">CURRENT EPOCH</h4>
                  <h4 className="value-text">{curEpoch}</h4>
                </center>
              </div>
            </div>
          </div>
          <div className="col-sm-3">
            <div className="card">
              <div className="card-body">
                <center>
                  <h4 className="subtitle">CLAIM YIELD FEE</h4>
                  <h4 className="value-text">{WITHDRAW_FEE / DENOMINATOR_PERCENT}%</h4>
                </center>
              </div>
            </div>
          </div>
        </div>
      </div>
      <br />
      <div className="container">
        <div className="row">
          <div className="col-sm-4">
            <div className="card cardDino">
              <div className="card-body">
                <h4 className="subtitle-normal" style={{ display: "flex", flexDirection: "row", justifyContent: "space-between" }}>
                  <b>BANK</b>
                  <b style={{ color: "rgb(254 222 91)" }}>{Number(totalAmount).toFixed(2)} BUSD</b>
                </h4>
                <hr />
                <table className="table">
                  <tbody>
                    <tr>
                      <td><h5 className="content-text"><b>WALLET</b></h5></td>
                      <td style={{ textAlign: "right", width: "160px" }}><h5 className="value-text">{Number(userBalance).toFixed(2)} BUSD</h5></td>
                    </tr>
                    <tr>
                      <td><h5 className="content-text"><b>DEPOSITED</b></h5></td>
                      <td style={{ textAlign: "right" }}><h5 className="value-text">{Number(userDepositedAmount).toFixed(2)} BUSD</h5></td>
                    </tr>
                    <tr>
                      <td>
                        <input
                          type="number"
                          placeholder="100 BUSD"
                          min={0}
                          className="form-control input-box"
                          value={depositValue}
                          step={10}
                          onChange={(e) => setDepositValue(e.target.value)}
                        />
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button className="btn btn-primary btn-lg btn-custom" style={{ width: "123px" }}
                          onClick={Number.isNaN(parseFloat(depositValue)) || userApprovedAmount > parseFloat(depositValue) ? deposit : approve}
                          disabled={pendingTx}
                        >
                          {Number.isNaN(parseFloat(depositValue)) || userApprovedAmount > parseFloat(depositValue) ? 'DEPOSIT' : 'APPROVE'}
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <br />
            <div className="card">
              <div className="card-body">
                <h4 className="subtitle-normal"><b>REFERRAL REWARDS  {REFERRAL_PERCENT / DENOMINATOR_PERCENT}%</b></h4>
                <hr />
                <table className="table">
                  <tbody>
                    <tr>
                      <td><h5 className="content-text">BUSD REWARDS</h5></td>
                      <td style={{ textAlign: "right" }}><h5 className="value-text">{Number(referralReward).toFixed(2)} BUSD</h5></td>
                    </tr>
                    <tr>
                      <td><h5 className="content-text">TOTAL</h5></td>
                      <td style={{ textAlign: "right" }}><h5 className="value-text">{Number(refTotalWithdraw).toFixed(2)} BUSD</h5></td>
                    </tr>
                  </tbody>
                </table>
                <center> <button className="btn btn-primary btn-lg btn-custom" onClick={refWithdraw} disabled={referralReward <= 0 || pendingTx}>WITHDRAW REWARDS</button> </center>
              </div>
            </div>
          </div>
          <div className="col-sm-4">
            <div className="card cardDino">
              <div className="card-body">
                <h4 className="subtitle-normal"><b>CLAIM REWARDS</b></h4>
                <hr />
                <table className="table">
                  <tbody>
                    {/* <tr>
                      <td><h6 className="content-text14" style={{ lineHeight: "20px" }}><b>50% AVAILABLE WITHDRAWAL</b> <br /><span className="value-text">{Number(approvedWithdraw).toFixed(3)} BUSD</span></h6></td>
                      <td style={{ textAlign: "right" }}><button className="btn btn-primary btn-lg btn-custom" onClick={withDraw}>WITHDRAW</button></td>
                    </tr> */}
                    <tr>
                      <td><h5 className="content-text">TOTAL</h5></td>
                      <td style={{ textAlign: "right" }}>
                        <h5 className="value-text">
                          {Number(web3NoAccount.utils.fromWei(userInfo && Object.keys(userInfo).length > 0 ? userInfo[5] : "0", DECIMALS)).toFixed(3)} BUSD
                        </h5>
                      </td>
                    </tr>
                    {/* <tr>
                      <td>
                        <h6 className="content-text" style={{ lineHeight: "20px" }}>
                          <b>LAST CLAIM</b><br />
                          <span className="value-text">
                            {Number(web3NoAccount.utils.fromWei(userInfo && Object.keys(userInfo).length > 0 ? userInfo[4] : "0", DECIMALS)).toFixed(3)} BUSD
                          </span>
                        </h6>
                      </td>
                      <td style={{ textAlign: "right", width: "180px" }} >
                        <h6 className="content-text" style={{ lineHeight: "20px" }}>
                          <b>ESTIMATED NEXT CLAIM</b><br /><span className="value-text">{Number(nextWithdraw).toFixed(3)} BUSD</span>
                        </h6>
                      </td>
                    </tr> */}
                    <tr>
                      <td><h5 className="content-text">LAST CLAIM</h5></td>
                      <td style={{ textAlign: "right" }}>
                        <h5 className="value-text">{Number(web3NoAccount.utils.fromWei(userInfo && Object.keys(userInfo).length > 0 ? userInfo[4] : "0", DECIMALS)).toFixed(3)} BUSD</h5>
                      </td>
                    </tr>
                    <tr>
                      <td><h5 className="content-text">ESTIMATED NEXT CLAIM</h5></td>
                      <td style={{ textAlign: "right" }}><h5 className="value-text">{Number(nextWithdraw).toFixed(3)} BUSD</h5></td>
                    </tr>
                    {/* <tr>
                      <td><h6 className="content-text14" style={{ lineHeight: "20px" }}><b>Weekly Yield</b> <br /> <span className="value-text">{Number(dailyReward).toFixed(3)}/{userDailyRoi} BUSD</span></h6></td>
                      <td style={{ textAlign: "right" }}><button className="btn btn-primary btn-lg btn-custom" onClick={ClaimNow} disabled={pendingTx}>CLAIM</button></td>
                    </tr> */}
                  </tbody>
                </table>
                <center>
                  <button className="btn btn-primary btn-lg btn-custom" onClick={ClaimNow} disabled={pendingTx || nextWithdraw <= 0}>CLAIM</button>
                </center>
              </div>
            </div>
          </div>
          <div className="col-sm-4">
            <div className="card">
              <div className="card-body">
                <h4 className="subtitle-normal">
                  <b>WITHDRAW</b>
                </h4>
                <hr />
                <table className="table">
                  <tbody>
                    <tr>
                      <td><h5 className="content-text">{withdrawState ? "Opening..." : "Remain Time:"}</h5></td>
                      <td style={{ textAlign: "right" }}>
                        <h5 className="value-text">
                          {displayRemainTime(remainTime)}
                        </h5>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <h6 className="content-text" style={{ lineHeight: "20px" }}>
                          <b>ENABLE</b><br /><span className="value-text">{Number(enabledAmount).toFixed(2)} BUSD</span>
                        </h6>
                      </td>
                      <td style={{ textAlign: "right", width: "160px" }} >
                        <h6 className="content-text" style={{ lineHeight: "20px" }}>
                          <b>REQUESTED</b><br />
                          <span className="value-text">
                            {Number(web3NoAccount.utils.fromWei(userInfo && Object.keys(userInfo).length > 0 ? userInfo[0] : "0", DECIMALS)).toFixed(2)} BUSD
                          </span>
                        </h6>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <input
                          type="number"
                          placeholder="100 BUSD"
                          min={0}
                          className="form-control input-box"
                          value={withdrawRequestValue}
                          step={10}
                          onChange={(e) => setWithdrawRequestValue(e.target.value)}
                        />
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button className="btn btn-primary btn-lg btn-custom" style={{ width: "123px" }}
                          onClick={withdrawRequest}
                          disabled={pendingTx}
                        >
                          REQUEST
                        </button>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <input
                          type="number"
                          placeholder="100 BUSD"
                          min={0}
                          className="form-control input-box"
                          value={withdrawValue}
                          step={10}
                          onChange={(e) => setWithdrawValue(e.target.value)}
                        />
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button className="btn btn-primary btn-lg btn-custom" style={{ width: "123px" }}
                          onClick={unStake}
                          disabled={
                            pendingTx ||
                            !withdrawState ||
                            Number.isNaN(withdrawValue) ||
                            parseFloat(withdrawValue) > enabledAmount ||
                            parseFloat(web3NoAccount.utils.fromWei(userInfo && Object.keys(userInfo).length > 0 ? userInfo[0] : "0", DECIMALS))
                          }
                        >
                          WITHDRAW
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        <br />
        <br />
      </div>
    </>);
}

export default Interface;
