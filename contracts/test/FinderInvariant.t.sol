// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import "forge-std/Test.sol";
import {Finder} from "../src/Finder.sol";

contract FinderHandler is Test {
  Finder public finder;
  address public seller = address(0x1111);
  address[] public finders;
  address[] public buyers;
  uint256 public activeId;
  uint128 public constant PRICE = 0.1 ether;
  uint16 public constant FINDER_BPS = 1000; // 10%

  constructor(Finder _finder) {
    finder = _finder;
    vm.deal(seller, 1000 ether);

    for (uint160 i = 1; i <= 5; i++) {
      address f = address(uint160(0x2000 + i));
      vm.deal(f, 1000 ether);
      finders.push(f);
    }

    for (uint160 i = 1; i <= 10; i++) {
      address b = address(uint160(0x3000 + i));
      vm.deal(b, 1000 ether);
      buyers.push(b);
    }

    vm.prank(seller);
    activeId = finder.list("Handler Offer", "Handler Desc", PRICE, FINDER_BPS, 1000, 30 days);
  }

  function buy(uint256 buyerIdx, uint256 finderIdx, bool useFinder) external {
    address buyer = buyers[buyerIdx % buyers.length];
    address f = useFinder ? finders[finderIdx % finders.length] : address(0);

    vm.prank(buyer);
    try finder.buy{value: PRICE}(activeId, f) {} catch {}
  }

  function withdraw(uint256 actorIdx) external {
    address actor;
    if (actorIdx % (finders.length + 2) == 0) {
      actor = seller;
    } else {
      actor = finders[(actorIdx - 1) % finders.length];
    }

    if (finder.pending(actor) > 0) {
      vm.prank(actor);
      try finder.withdraw() {} catch {}
    }
  }

  function getFinders() external view returns (address[] memory) {
    return finders;
  }
}

contract FinderInvariantTest is Test {
  Finder public finder;
  FinderHandler public handler;

  function setUp() public {
    finder = new Finder();
    handler = new FinderHandler(finder);
    targetContract(address(handler));
  }

  function invariant_BalanceEqualsPending() public view {
    address seller = handler.seller();
    address[] memory finders = handler.getFinders();

    uint256 totalPending = finder.pending(seller);
    for (uint256 i = 0; i < finders.length; i++) {
      totalPending += finder.pending(finders[i]);
    }

    assertEq(address(finder).balance, totalPending);
  }

  function invariant_SoldLessThanOrEqualToStock() public view {
    uint256 id = handler.activeId();
    Finder.Offer memory o = finder.offerOf(id);
    assertTrue(o.sold <= o.stock);
  }
}
