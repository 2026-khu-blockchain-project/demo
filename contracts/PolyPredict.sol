// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PolyPredict
 * @dev Polymarket 스타일 단순 예측 시장 — USDC 담보, 이진(YES/NO) 정산
 *
 *   - ERC-1155: 시장별 YES/NO 토큰
 *   - 담보: 1 USDC 예치 → (1 YES + 1 NO) 발행
 *   - 정산: 컨트랙트 Owner(관리자)가 마감 후 결과 확정 → 사용자 claim
 */
contract PolyPredict is ERC1155, Ownable, ReentrancyGuard {

    enum MarketState { OPEN, CLOSED, RESOLVED }
    enum Outcome    { NONE, YES, NO }

    struct Market {
        string      question;
        uint256     deadline;
        MarketState state;
        Outcome     outcome;
        uint256     totalCollateral;
    }

    IERC20  public immutable usdc;
    uint256 public marketCount;

    mapping(uint256 => Market) public markets;

    event MarketCreated(
        uint256 indexed marketId,
        string  question,
        uint256 deadline
    );

    event SharesMinted(
        uint256 indexed marketId,
        address indexed buyer,
        uint256 amount
    );

    event MarketResolved(
        uint256 indexed marketId,
        Outcome outcome
    );

    event WinningsClaimed(
        uint256 indexed marketId,
        address indexed claimer,
        uint256 usdcAmount
    );

    constructor(address _usdc) ERC1155("") Ownable(msg.sender) {
        usdc = IERC20(_usdc);
    }

    /**
     * @notice 새 예측 시장 생성 (Owner 전용)
     */
    function createMarket(
        string calldata _question,
        uint256 _deadline
    ) external onlyOwner returns (uint256 marketId) {
        require(_deadline > block.timestamp, "Deadline must be in the future");

        marketId = marketCount++;

        markets[marketId] = Market({
            question:        _question,
            deadline:        _deadline,
            state:           MarketState.OPEN,
            outcome:         Outcome.NONE,
            totalCollateral: 0
        });

        emit MarketCreated(marketId, _question, _deadline);
    }

    function mintShares(uint256 _marketId, uint256 _amount) external nonReentrant {
        Market storage m = markets[_marketId];

        require(m.state == MarketState.OPEN,    "Market is not open");
        require(block.timestamp < m.deadline,   "Betting deadline passed");
        require(_amount > 0,                    "Amount must be > 0");

        bool success = usdc.transferFrom(msg.sender, address(this), _amount);
        require(success, "USDC transfer failed");

        m.totalCollateral += _amount;

        uint256 yesId = _marketId * 2;
        uint256 noId  = _marketId * 2 + 1;

        _mint(msg.sender, yesId, _amount, "");
        _mint(msg.sender, noId,  _amount, "");

        emit SharesMinted(_marketId, msg.sender, _amount);
    }

    /**
     * @notice 시장 결과 확정 (Owner / 관리자 전용, 마감 후)
     */
    function resolveMarket(uint256 _marketId, Outcome _outcome) external onlyOwner {
        Market storage m = markets[_marketId];

        require(m.state == MarketState.OPEN,         "Market already resolved");
        require(block.timestamp >= m.deadline,       "Deadline not reached yet");
        require(_outcome == Outcome.YES || _outcome == Outcome.NO, "Invalid outcome");

        m.state   = MarketState.RESOLVED;
        m.outcome = _outcome;

        emit MarketResolved(_marketId, _outcome);
    }

    function claimWinnings(uint256 _marketId) external nonReentrant {
        Market storage m = markets[_marketId];

        require(m.state == MarketState.RESOLVED, "Market not resolved yet");

        uint256 yesId = _marketId * 2;
        uint256 noId  = _marketId * 2 + 1;

        uint256 yesBalance = balanceOf(msg.sender, yesId);
        uint256 noBalance  = balanceOf(msg.sender, noId);

        require(yesBalance > 0 || noBalance > 0, "No shares to claim");

        uint256 payout = 0;

        if (m.outcome == Outcome.YES) {
            payout = yesBalance;
            if (yesBalance > 0) _burn(msg.sender, yesId, yesBalance);
            if (noBalance  > 0) _burn(msg.sender, noId,  noBalance);
        } else {
            payout = noBalance;
            if (noBalance  > 0) _burn(msg.sender, noId,  noBalance);
            if (yesBalance > 0) _burn(msg.sender, yesId, yesBalance);
        }

        require(payout > 0, "No winning shares");

        bool success = usdc.transfer(msg.sender, payout);
        require(success, "USDC payout failed");

        emit WinningsClaimed(_marketId, msg.sender, payout);
    }

    function getShareBalances(uint256 _marketId, address _user)
        external view
        returns (uint256 yesBalance, uint256 noBalance)
    {
        yesBalance = balanceOf(_user, _marketId * 2);
        noBalance  = balanceOf(_user, _marketId * 2 + 1);
    }

    function getMarket(uint256 _marketId) external view returns (Market memory) {
        return markets[_marketId];
    }

    function getTokenIds(uint256 _marketId)
        external pure
        returns (uint256 yesId, uint256 noId)
    {
        yesId = _marketId * 2;
        noId  = _marketId * 2 + 1;
    }
}
