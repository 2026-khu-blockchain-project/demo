// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSDC
 * @dev 테스트용 USDC - 실제 USDC는 6 decimals 사용
 */
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    // 테스트용 무제한 발행 함수
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
