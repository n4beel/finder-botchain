// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

contract Finder {
  // --- Errors ---
  error BadText();
  error BadParams();
  error OfferNotFound();
  error Ended();
  error SoldOut();
  error SellerCannotBuy();
  error WrongPayment(uint256 expected);
  error BadFinder();
  error NothingToWithdraw();
  error TransferFailed();
  error Reentrancy();

  // --- Constants ---
  uint256 public constant MAX_NAME_BYTES = 64;
  uint256 public constant MAX_DESC_BYTES = 300;
  uint128 public constant MIN_PRICE = 0.001 ether;
  uint128 public constant MAX_PRICE = 1_000_000 ether;
  uint16 public constant MIN_BPS = 100;   // 1%
  uint16 public constant MAX_BPS = 3000;  // 30%
  uint32 public constant MAX_STOCK = 10_000;
  uint64 public constant MIN_DURATION = 1 hours;
  uint64 public constant MAX_DURATION = 365 days;
  uint256 public constant MAX_PAGE = 50;

  // --- Types ---
  struct Offer {
    address seller;
    uint64 endsAt;
    uint32 stock;
    uint32 sold;
    uint16 finderBps;
    uint32 openedBlock;
    uint128 price;
    string name;
  }

  // --- Storage ---
  mapping(uint256 => Offer) private _offers;
  mapping(uint256 => mapping(address => uint32)) private _foundCount;   // buyers a finder brought to an offer
  mapping(uint256 => mapping(address => uint128)) private _foundEarned; // what a finder earned on an offer
  mapping(address => uint256) public earned;                            // a finder's lifetime commission
  mapping(address => uint32) public found;                              // a finder's lifetime buyers
  mapping(address => uint256) public pending;
  uint256 public offerCount;                                            // ids start at 1

  bool private _locked;

  // --- Events ---
  event Listed(
    uint256 indexed id,
    address indexed seller,
    string name,
    string description,
    uint128 price,
    uint16 finderBps,
    uint32 stock,
    uint64 endsAt
  );
  event Bought(
    uint256 indexed id,
    address indexed buyer,
    address indexed finder,
    uint128 price,
    uint128 commission
  );
  event Withdrawn(address indexed to, uint256 amount);

  // --- Modifiers ---
  modifier nonReentrant() {
    if (_locked) revert Reentrancy();
    _locked = true;
    _;
    _locked = false;
  }

  // --- External Mutating Functions ---

  /// @notice List a new offer with finder commission
  function list(
    string calldata name,
    string calldata description,
    uint128 price,
    uint16 finderBps,
    uint32 stock,
    uint64 durationSecs
  ) external returns (uint256 id) {
    bytes memory nameBytes = bytes(name);
    bytes memory descBytes = bytes(description);

    if (nameBytes.length == 0 || nameBytes.length > MAX_NAME_BYTES) revert BadText();
    if (descBytes.length == 0 || descBytes.length > MAX_DESC_BYTES) revert BadText();

    if (price < MIN_PRICE || price > MAX_PRICE) revert BadParams();
    if (finderBps < MIN_BPS || finderBps > MAX_BPS) revert BadParams();
    if (stock == 0 || stock > MAX_STOCK) revert BadParams();
    if (durationSecs < MIN_DURATION || durationSecs > MAX_DURATION) revert BadParams();

    id = ++offerCount;
    uint64 endsAt = uint64(block.timestamp + durationSecs);

    Offer storage o = _offers[id];
    o.seller = msg.sender;
    o.endsAt = endsAt;
    o.stock = stock;
    o.sold = 0;
    o.finderBps = finderBps;
    o.openedBlock = uint32(block.number);
    o.price = price;
    o.name = name;

    emit Listed(id, msg.sender, name, description, price, finderBps, stock, endsAt);
  }

  /// @notice Purchase an item from an offer, attributing the sale to finder if valid
  function buy(uint256 id, address finder) external payable {
    if (id == 0 || id > offerCount) revert OfferNotFound();
    Offer storage o = _offers[id];

    if (block.timestamp >= o.endsAt) revert Ended();
    if (o.sold >= o.stock) revert SoldOut();
    if (msg.sender == o.seller) revert SellerCannotBuy();
    if (msg.value != o.price) revert WrongPayment(o.price);

    uint128 commission = 0;
    if (finder != address(0)) {
      if (finder == msg.sender || finder == o.seller || finder == address(this)) {
        revert BadFinder();
      }
      commission = uint128((uint256(o.price) * uint256(o.finderBps)) / 10_000);
      pending[finder] += commission;
      _foundCount[id][finder] += 1;
      _foundEarned[id][finder] += commission;
      earned[finder] += commission;
      found[finder] += 1;
    }

    uint128 toSeller = o.price - commission;
    pending[o.seller] += toSeller;
    o.sold += 1;

    emit Bought(id, msg.sender, finder, o.price, commission);
  }

  /// @notice Pull accrued seller or finder earnings
  function withdraw() external nonReentrant {
    uint256 amount = pending[msg.sender];
    if (amount == 0) revert NothingToWithdraw();

    pending[msg.sender] = 0;

    (bool ok,) = msg.sender.call{value: amount}("");
    if (!ok) revert TransferFailed();

    emit Withdrawn(msg.sender, amount);
  }

  // --- View Functions ---

  /// @notice Retrieve offer details
  function offerOf(uint256 id) external view returns (Offer memory) {
    if (id == 0 || id > offerCount) revert OfferNotFound();
    return _offers[id];
  }

  /// @notice Retrieve finder activity and earnings for a given offer
  function foundOn(uint256 id, address finder)
    external
    view
    returns (uint32 buyers, uint128 earnedAmount)
  {
    if (id == 0 || id > offerCount) revert OfferNotFound();
    buyers = _foundCount[id][finder];
    earnedAmount = _foundEarned[id][finder];
  }

  /// @notice Quote how the price would be split between seller and finder
  function quoteSplit(uint256 id, bool hasFinder)
    external
    view
    returns (uint128 toSeller, uint128 toFinder)
  {
    if (id == 0 || id > offerCount) revert OfferNotFound();
    Offer storage o = _offers[id];

    if (!hasFinder) {
      return (o.price, 0);
    }

    toFinder = uint128((uint256(o.price) * uint256(o.finderBps)) / 10_000);
    toSeller = o.price - toFinder;
  }

  /// @notice Retrieve latest offers
  function latest(uint256 offset, uint256 count)
    external
    view
    returns (uint256[] memory ids, Offer[] memory offers, uint256 total)
  {
    total = offerCount;
    if (count > MAX_PAGE) {
      count = MAX_PAGE;
    }

    if (offset >= total || count == 0) {
      return (new uint256[](0), new Offer[](0), total);
    }

    if (offset + count > total) {
      count = total - offset;
    }

    ids = new uint256[](count);
    offers = new Offer[](count);

    for (uint256 i = 0; i < count; i++) {
      uint256 id = total - (offset + i);
      ids[i] = id;
      offers[i] = _offers[id];
    }
  }
}
