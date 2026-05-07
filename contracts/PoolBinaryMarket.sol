// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PoolBinaryMarket
 * @notice 이진 시장 — YES/NO 배팅 풀 기반 (패리뮤추얼). 풀 비율로 내재 확률·배당 형태가 정해짐.
 * @dev Polymarket CLOB/AMM과는 다르지만, Pot 기준 확률·승자 배분 흐름을 단순히 온체인화.
 *      - 최대 참가자 10명 (서로 다른 주소)
 *      - 주소당 총 예치 상한 1000 USDC (6 decimals)
 */
contract PoolBinaryMarket is Ownable, ReentrancyGuard {
    IERC20 public immutable usdc;

    uint8 public constant DECIMALS = 6;
    uint256 public constant MAX_STAKE_PER_USER = 1000 * 10 ** uint256(DECIMALS);
    uint256 public constant MAX_PARTICIPANTS = 10;

    enum Outcome {
        None,
        Yes,
        No
    }

    Outcome public outcome;

    uint256 public totalYes;
    uint256 public totalNo;

    mapping(address => uint256) public yesOf;
    mapping(address => uint256) public noOf;

    address[] private participantList;
    mapping(address => bool) private isListed;

    bool public resolved;

    event BetPlaced(address indexed user, bool yesSide, uint256 amount);
    event MarketResolved(Outcome o);
    event Claimed(address indexed user, uint256 amount);

    constructor(address _usdc) Ownable(msg.sender) {
        usdc = IERC20(_usdc);
    }

    function participantCount() external view returns (uint256) {
        return participantList.length;
    }

    function participantAt(uint256 i) external view returns (address) {
        return participantList[i];
    }

    /// @notice 풀 비율로 YES 내재 확률 (basis points, 10000 = 100%). 풀이 비면 5000.
    function impliedYesBps() external view returns (uint256) {
        uint256 t = totalYes + totalNo;
        if (t == 0) return 5000;
        return (totalYes * 10000) / t;
    }

    /// @notice YES 승리 시 1 USDC(단위)당 대략 회수 배수 = (totalYes+totalNo) / totalYes (표시용)
    function yesPoolMultiplierE4() external view returns (uint256) {
        if (totalYes == 0) return 0;
        return ((totalYes + totalNo) * 10000) / totalYes;
    }

    /// @notice NO 승리 시 대응 배수
    function noPoolMultiplierE4() external view returns (uint256) {
        if (totalNo == 0) return 0;
        return ((totalYes + totalNo) * 10000) / totalNo;
    }

    /// @param yes true = YES 쪽에 배팅
    function placeBet(bool yes, uint256 amount) external nonReentrant {
        require(!resolved, "resolved");
        require(amount > 0, "amount");

        uint256 prev = yesOf[msg.sender] + noOf[msg.sender];
        require(prev + amount <= MAX_STAKE_PER_USER, "per-user cap 1000");

        if (!isListed[msg.sender]) {
            require(participantList.length < MAX_PARTICIPANTS, "max 10 users");
            participantList.push(msg.sender);
            isListed[msg.sender] = true;
        }

        bool ok = usdc.transferFrom(msg.sender, address(this), amount);
        require(ok, "USDC transfer");

        if (yes) {
            totalYes += amount;
            yesOf[msg.sender] += amount;
        } else {
            totalNo += amount;
            noOf[msg.sender] += amount;
        }

        emit BetPlaced(msg.sender, yes, amount);
    }

    function resolve(Outcome o) external onlyOwner {
        require(o == Outcome.Yes || o == Outcome.No, "invalid");
        require(outcome == Outcome.None, "already");
        resolved = true;
        outcome = o;
        emit MarketResolved(o);
    }

    function claim() external nonReentrant {
        require(resolved, "not resolved");
        require(outcome != Outcome.None, "no outcome");

        uint256 payout;
        if (outcome == Outcome.Yes) {
            uint256 y = yesOf[msg.sender];
            require(y > 0, "no winning YES stake");
            uint256 pool = totalYes + totalNo;
            payout = (pool * y) / totalYes;
            yesOf[msg.sender] = 0;
            noOf[msg.sender] = 0;
        } else {
            uint256 n = noOf[msg.sender];
            require(n > 0, "no winning NO stake");
            uint256 pool = totalYes + totalNo;
            payout = (pool * n) / totalNo;
            noOf[msg.sender] = 0;
            yesOf[msg.sender] = 0;
        }

        require(payout > 0, "zero payout");
        require(usdc.transfer(msg.sender, payout), "payout");
        emit Claimed(msg.sender, payout);
    }
}
