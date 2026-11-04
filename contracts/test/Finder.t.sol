// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import "forge-std/Test.sol";
import {Finder} from "../src/Finder.sol";

contract MaliciousRecipient {
  Finder public finder;
  constructor(Finder _finder) {
    finder = _finder;
  }
  receive() external payable {
    finder.withdraw();
  }
}

contract FinderTest is Test {
  Finder public finder;

  address public seller = address(0x1111);
  address public finder1 = address(0x2222);
  address public finder2 = address(0x3333);
  address public buyerA = address(0x4444);
  address public buyerB = address(0x5555);

  uint128 public constant PRICE = 1 ether;
  uint16 public constant FINDER_BPS = 1000; // 10%
  uint32 public constant STOCK = 5;
  uint64 public constant DURATION = 7 days;

  function setUp() public {
    finder = new Finder();
    vm.deal(seller, 100 ether);
    vm.deal(finder1, 100 ether);
    vm.deal(finder2, 100 ether);
    vm.deal(buyerA, 100 ether);
    vm.deal(buyerB, 100 ether);
  }

  function test_ListAndBuyWithoutFinder() public {
    vm.prank(seller);
    uint256 id = finder.list("Handmade Mug", "A beautiful ceramic mug", PRICE, FINDER_BPS, STOCK, DURATION);
    assertEq(id, 1);

    Finder.Offer memory o = finder.offerOf(id);
    assertEq(o.seller, seller);
    assertEq(o.price, PRICE);
    assertEq(o.finderBps, FINDER_BPS);
    assertEq(o.stock, STOCK);
    assertEq(o.sold, 0);

    // Buyer buys with no finder
    vm.prank(buyerA);
    finder.buy{value: PRICE}(id, address(0));

    // Seller gets 100% of price
    assertEq(finder.pending(seller), PRICE);
    assertEq(finder.offerOf(id).sold, 1);
  }

  function test_BuyWithFinderSplitsPrice() public {
    vm.prank(seller);
    uint256 id = finder.list("Tech Book", "Modern systems guide", 2 ether, 1500, 10, DURATION); // 15%

    // 15% of 2 ether = 0.3 ether
    // Seller gets 1.7 ether
    vm.prank(buyerA);
    finder.buy{value: 2 ether}(id, finder1);

    assertEq(finder.pending(finder1), 0.3 ether);
    assertEq(finder.pending(seller), 1.7 ether);

    (uint32 bCount, uint128 earnedAmount) = finder.foundOn(id, finder1);
    assertEq(bCount, 1);
    assertEq(earnedAmount, 0.3 ether);
    assertEq(finder.found(finder1), 1);
    assertEq(finder.earned(finder1), 0.3 ether);
  }

  function test_CommissionRounding() public {
    vm.prank(seller);
    // Odd price: 1 wei, cut 10% (1000 bps)
    // 1 * 1000 / 10000 = 0 commission, seller gets 1 wei
    uint256 id = finder.list("Penny Candy", "Sweet treat", 0.001 ether + 1 wei, 1000, 10, DURATION);

    uint128 p = 0.001 ether + 1 wei;
    uint128 expectedComm = uint128((uint256(p) * 1000) / 10000);
    uint128 expectedSeller = p - expectedComm;

    vm.prank(buyerA);
    finder.buy{value: p}(id, finder1);

    assertEq(finder.pending(finder1), expectedComm);
    assertEq(finder.pending(seller), expectedSeller);
  }

  function test_BadFinderSellerBuyerContractRevert() public {
    vm.prank(seller);
    uint256 id = finder.list("Item", "Desc", PRICE, FINDER_BPS, STOCK, DURATION);

    // Buyer cannot name themselves
    vm.startPrank(buyerA);
    vm.expectRevert(Finder.BadFinder.selector);
    finder.buy{value: PRICE}(id, buyerA);

    // Buyer cannot name seller
    vm.expectRevert(Finder.BadFinder.selector);
    finder.buy{value: PRICE}(id, seller);

    // Buyer cannot name contract
    vm.expectRevert(Finder.BadFinder.selector);
    finder.buy{value: PRICE}(id, address(finder));
    vm.stopPrank();
  }

  function test_SellerCannotBuy() public {
    vm.prank(seller);
    uint256 id = finder.list("Item", "Desc", PRICE, FINDER_BPS, STOCK, DURATION);

    vm.prank(seller);
    vm.expectRevert(Finder.SellerCannotBuy.selector);
    finder.buy{value: PRICE}(id, finder1);
  }

  function test_WrongPaymentReverts_ArgsExpected() public {
    vm.prank(seller);
    uint256 id = finder.list("Item", "Desc", PRICE, FINDER_BPS, STOCK, DURATION);

    vm.prank(buyerA);
    vm.expectRevert(abi.encodeWithSelector(Finder.WrongPayment.selector, PRICE));
    finder.buy{value: PRICE - 1}(id, finder1);
  }

  function test_SoldOutReverts() public {
    vm.prank(seller);
    uint256 id = finder.list("Limited Art", "1 of 1 print", PRICE, FINDER_BPS, 1, DURATION);

    vm.prank(buyerA);
    finder.buy{value: PRICE}(id, finder1);

    vm.prank(buyerB);
    vm.expectRevert(Finder.SoldOut.selector);
    finder.buy{value: PRICE}(id, finder1);
  }

  function test_EndedReverts() public {
    vm.prank(seller);
    uint256 id = finder.list("Flash Sale", "Only 2 hours", PRICE, FINDER_BPS, STOCK, 2 hours);

    vm.warp(block.timestamp + 2 hours + 1);

    vm.prank(buyerA);
    vm.expectRevert(Finder.Ended.selector);
    finder.buy{value: PRICE}(id, finder1);
  }

  function test_PerOfferTalliesTrackFinders() public {
    vm.prank(seller);
    uint256 id = finder.list("Workshop Pass", "Live training", PRICE, 2000, 10, DURATION); // 20%

    // Buyer A via Finder 1
    vm.prank(buyerA);
    finder.buy{value: PRICE}(id, finder1);

    // Buyer B via Finder 1
    vm.prank(buyerB);
    finder.buy{value: PRICE}(id, finder1);

    (uint32 bCount, uint128 earnedAmount) = finder.foundOn(id, finder1);
    assertEq(bCount, 2);
    assertEq(earnedAmount, 0.4 ether);

    // Finder 2 has 0
    (uint32 f2Count, uint128 f2Earned) = finder.foundOn(id, finder2);
    assertEq(f2Count, 0);
    assertEq(f2Earned, 0);
  }

  function test_LifetimeTotalsAcrossOffers() public {
    vm.startPrank(seller);
    uint256 id1 = finder.list("Course 1", "Desc", 1 ether, 1000, 10, DURATION);
    uint256 id2 = finder.list("Course 2", "Desc", 2 ether, 2000, 10, DURATION);
    vm.stopPrank();

    // Finder 1 on id1: 0.1 ether
    vm.prank(buyerA);
    finder.buy{value: 1 ether}(id1, finder1);

    // Finder 1 on id2: 0.4 ether
    vm.prank(buyerB);
    finder.buy{value: 2 ether}(id2, finder1);

    assertEq(finder.found(finder1), 2);
    assertEq(finder.earned(finder1), 0.5 ether);
  }

  function test_BadTextParamsRevert() public {
    vm.startPrank(seller);
    // Bad text: empty name
    vm.expectRevert(Finder.BadText.selector);
    finder.list("", "Desc", PRICE, FINDER_BPS, STOCK, DURATION);

    // Bad text: name > 64 bytes
    bytes memory longName = new bytes(65);
    vm.expectRevert(Finder.BadText.selector);
    finder.list(string(longName), "Desc", PRICE, FINDER_BPS, STOCK, DURATION);

    // Bad text: empty desc
    vm.expectRevert(Finder.BadText.selector);
    finder.list("Valid", "", PRICE, FINDER_BPS, STOCK, DURATION);

    // Bad params: price too low (< 0.001 ether)
    vm.expectRevert(Finder.BadParams.selector);
    finder.list("Valid", "Desc", 0.0009 ether, FINDER_BPS, STOCK, DURATION);

    // Bad params: bps too low (< 100)
    vm.expectRevert(Finder.BadParams.selector);
    finder.list("Valid", "Desc", PRICE, 99, STOCK, DURATION);

    // Bad params: bps too high (> 3000)
    vm.expectRevert(Finder.BadParams.selector);
    finder.list("Valid", "Desc", PRICE, 3001, STOCK, DURATION);

    // Bad params: stock == 0
    vm.expectRevert(Finder.BadParams.selector);
    finder.list("Valid", "Desc", PRICE, FINDER_BPS, 0, DURATION);

    // Bad params: duration < 1 hour
    vm.expectRevert(Finder.BadParams.selector);
    finder.list("Valid", "Desc", PRICE, FINDER_BPS, STOCK, 59 minutes);
    vm.stopPrank();
  }

  function test_QuoteSplitMatches() public {
    vm.prank(seller);
    uint256 id = finder.list("Item", "Desc", 5 ether, 2000, 10, DURATION); // 20%

    (uint128 sNo, uint128 fNo) = finder.quoteSplit(id, false);
    assertEq(sNo, 5 ether);
    assertEq(fNo, 0);

    (uint128 sYes, uint128 fYes) = finder.quoteSplit(id, true);
    assertEq(sYes, 4 ether);
    assertEq(fYes, 1 ether);
  }

  function test_ReentrantWithdrawBlocked() public {
    MaliciousRecipient mal = new MaliciousRecipient(finder);
    vm.deal(address(mal), 10 ether);

    vm.prank(seller);
    uint256 id = finder.list("Item", "Desc", PRICE, FINDER_BPS, STOCK, DURATION);

    // Buyer purchases naming malicious contract as finder
    vm.prank(buyerA);
    finder.buy{value: PRICE}(id, address(mal));

    // mal tries reentrancy during withdraw
    vm.prank(address(mal));
    vm.expectRevert(Finder.TransferFailed.selector);
    finder.withdraw();
  }

  function test_ViewsAndPagination() public {
    vm.startPrank(seller);
    finder.list("Item 1", "Desc", PRICE, FINDER_BPS, STOCK, DURATION);
    finder.list("Item 2", "Desc", PRICE, FINDER_BPS, STOCK, DURATION);
    finder.list("Item 3", "Desc", PRICE, FINDER_BPS, STOCK, DURATION);
    vm.stopPrank();

    (uint256[] memory ids, Finder.Offer[] memory offers, uint256 total) = finder.latest(0, 2);
    assertEq(total, 3);
    assertEq(ids.length, 2);
    assertEq(ids[0], 3);
    assertEq(ids[1], 2);
    assertEq(offers[0].name, "Item 3");
  }

  function testFuzz_SplitConservesPrice(uint32 priceSeed, uint16 bpsSeed) public {
    uint128 p = uint128(bound(priceSeed, 0.001 ether, 100 ether));
    uint16 bps = uint16(bound(bpsSeed, 100, 3000));

    vm.prank(seller);
    uint256 id = finder.list("Fuzz Offer", "Desc", p, bps, 10, DURATION);

    vm.prank(buyerA);
    finder.buy{value: p}(id, finder1);

    uint256 comm = finder.pending(finder1);
    uint256 sAmount = finder.pending(seller);

    assertEq(comm + sAmount, p);
    assertTrue(comm <= (uint256(p) * bps) / 10000);
  }

  function testFuzz_TalliesMatchPayments(uint8 buyerCountRaw) public {
    uint8 count = uint8(bound(buyerCountRaw, 1, 10));

    vm.prank(seller);
    uint256 id = finder.list("Tally Offer", "Desc", PRICE, FINDER_BPS, 20, DURATION);

    for (uint160 i = 0; i < count; i++) {
      address b = address(0x9000 + i);
      vm.deal(b, 10 ether);
      vm.prank(b);
      finder.buy{value: PRICE}(id, finder1);
    }

    (uint32 buyersFound, uint128 earnedOnOffer) = finder.foundOn(id, finder1);
    assertEq(buyersFound, count);

    uint128 singleComm = uint128((uint256(PRICE) * FINDER_BPS) / 10000);
    assertEq(earnedOnOffer, uint128(count) * singleComm);
    assertEq(finder.earned(finder1), uint128(count) * singleComm);
    assertEq(finder.found(finder1), count);
  }
}
