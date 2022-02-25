/* global splinterlands, snapyr, paypal */
/* eslint-disable max-classes-per-file */
splinterlands.Store = class {
  static get payment_tokens() {
    const currencies = [
      { name: 'HIVE', symbol: 'HIVE' },
      { name: 'STEEM', symbol: 'STEEM' },
      { name: 'Tron', symbol: 'TRX' },
      { name: 'Hive Dollars', symbol: 'HBD' },
      { name: 'Steem Dollars', symbol: 'SBD' },
      { name: 'Bitcoin', symbol: 'BTC' },
      { name: 'Ether', symbol: 'ETH' },
      { name: 'Litecoin', symbol: 'LTC' },
      { name: 'EOS', symbol: 'EOS' },
      { name: 'WAX', symbol: 'WAXP' },
      { name: 'Electroneum', symbol: 'ETN' },
    ];

    if (splinterlands.ethereum.hasWeb3Obj()) {
      currencies.push({ name: 'Basic Attention Token', symbol: 'BAT' });
      currencies.push({ name: 'Enjin Coin', symbol: 'ENJ' });
      currencies.push({ name: 'Uniswap', symbol: 'UNI' });
      currencies.push({ name: 'SAND', symbol: 'SAND' });
      currencies.push({ name: 'GALA', symbol: 'GALA' });
      currencies.push({ name: 'GAME', symbol: 'GAME' });
    }

    return currencies;
  }

  static async get_available_packs(edition) {
    try {
      const { packs } = await splinterlands.api('/purchases/stats');
      return packs.find((p) => p.edition == edition).available;
    } catch (err) {
      return 0;
    }
  }

  static get booster_price() {
    return splinterlands.get_settings().booster_pack_price;
  }

  static get starter_price() {
    return splinterlands.get_settings().starter_pack_price;
  }

  static get orb_price() {
    return splinterlands.get_settings().dec.orb_cost;
  }

  static get dice_price() {
    return splinterlands.get_settings().dec.dice_cost;
  }

  static pack_purchase_info(edition, qty) {
    if (edition == 4) {
      return {
        edition,
        qty,
        bonus: Math.floor(qty >= 500 ? qty * 0.15 : qty >= 100 ? qty * 0.1 : 0),
        total_usd: +(qty * splinterlands.Store.booster_price).toFixed(2),
        total_dec: Math.floor(qty * splinterlands.Store.booster_price * 1000),
      };
    }
    if (edition == 2) {
      return {
        edition,
        qty,
        bonus: Math.floor(qty >= 100 ? qty * 0.1 : qty >= 20 ? qty * 0.05 : 0),
        total_usd: +((qty * splinterlands.Store.orb_price) / 1000).toFixed(2),
        total_dec: Math.floor(splinterlands.utils.guild_discounted_cost(qty * splinterlands.Store.orb_price)),
      };
    }
    if (edition == 5) {
      return {
        edition,
        qty,
        bonus: Math.floor(qty >= 100 ? qty * 0.1 : qty >= 20 ? qty * 0.05 : 0),
        total_usd: +((qty * splinterlands.Store.dice_price) / 1000).toFixed(2),
        total_dec: Math.floor(splinterlands.utils.guild_discounted_cost(qty * splinterlands.Store.dice_price)),
      };
    }

    return { error: 'Invalid pack edition specified.' };
  }

  static potion_purchase_info(type, qty) {
    const potion = splinterlands.Potion.get_potion(type);

    if (!potion) {
      return { error: 'Invalid potion type specified.' };
    }

    const bonus_obj = potion.bonuses
      .slice()
      .reverse()
      .find((b) => b.min <= qty);

    return {
      type,
      qty,
      bonus: bonus_obj ? Math.floor((qty * bonus_obj.bonus_pct) / 100) : 0,
      total_usd: +((potion.price_per_charge * qty) / 1000).toFixed(2),
      total_dec: Math.floor(potion.price_per_charge * qty),
    };
  }

  static get currencies() {
    const currencies = [
      { name: 'HIVE', symbol: 'HIVE' },
      { name: 'STEEM', symbol: 'STEEM' },
      { name: 'Tron', symbol: 'TRX' },
      { name: 'Hive Dollars', symbol: 'HBD' },
      { name: 'Steem Dollars', symbol: 'SBD' },
      { name: 'Bitcoin', symbol: 'BTC' },
      { name: 'Ether', symbol: 'ETH' },
      { name: 'Litecoin', symbol: 'LTC' },
      { name: 'Binance Coin', symbol: 'BNB' },
      { name: 'KuCoin Shares', symbol: 'KCS' },
      { name: 'EOS', symbol: 'EOS' },
    ];

    if (splinterlands.ethereum.hasWeb3Obj()) {
      currencies.push({ name: 'Basic Attention Token', symbol: 'BAT' });
      currencies.push({ name: 'Enjin Coin', symbol: 'ENJ' });
      currencies.push({ name: 'Uniswap', symbol: 'UNI' });
      currencies.push({ name: 'SAND', symbol: 'SAND' });
      currencies.push({ name: 'GALA', symbol: 'GALA' });
      currencies.push({ name: 'GAME', symbol: 'GAME' });
    }

    return currencies;
  }

  static async start_purchase(type, qty, currency, merchant, data, purchase_origin) {
    let orig_currency = currency;
    const player = splinterlands.get_player() ? splinterlands.get_player().name : '';

    if (!['HIVE', 'HBD', 'DEC'].includes(currency)) {
      currency = 'HIVE';
    }

    if (orig_currency === 'WAXP') {
      orig_currency = 'WAX';
    }

    console.log('orig_currency: ', orig_currency);
    if (!purchase_origin) {
      if (splinterlands.is_mobile_app && splinterlands.mobile_OS === 'android') {
        purchase_origin = 'google';
      } else if (splinterlands.is_mobile_app && splinterlands.mobile_OS === 'iOS') {
        purchase_origin = 'apple';
      } else {
        purchase_origin = 'crypto';
      }
    }

    const params = { player, type, qty, currency, orig_currency, purchase_origin };

    if (merchant) {
      params.merchant = merchant;
    }

    if (data) {
      params.data = data;
    }

    if (splinterlands.is_mobile_app) {
      params.app = splinterlands.mobile_OS;
    }

    if (purchase_origin == 'apple' && (type == 'credits' || type == 'starter_pack')) {
      return {
        error:
          'We are very sorry but purchases of Credits/Spellbooks are currently unavailable on the Splinterlands mobile app. You may also log into your account and play at https://splinterlands.com',
      };
    }

    if (purchase_origin == 'google' && (type == 'credits' || type == 'starter_pack')) {
      return {
        error:
          'We are very sorry but purchases of Credits/Spellbooks are currently unavailable on the Splinterlands mobile app. You may also log into your account and play at https://splinterlands.com',
      };
    }

    snapyr.track('start_purchase', {
      type,
      quantity: qty,
      currency,
      merchant,
    });

    return new splinterlands.Purchase(await splinterlands.api('/purchases/start', params));
  }

  static async airdrop_info(edition) {
    if (!edition) {
      edition = 4;
    }
    const purchases = await splinterlands.api('/players/pack_purchases', { edition });
    const available = await splinterlands.Store.get_available_packs(edition);

    if (edition === 5) {
      return {
        total_purchased: 50000 - (available % 50000),
        total_remaining: available % 50000,
        player_purchased: purchases ? parseInt(purchases.packs) + parseInt(purchases.bonus_packs) : 0,
      };
    }
    return {
      total_purchased: 100000 - (available % 100000),
      total_remaining: available % 100000,
      player_purchased: purchases ? parseInt(purchases.packs) + parseInt(purchases.bonus_packs) : 0,
    };
  }

  static async paypal_button(type, get_qty) {
    if (!window.paypal) {
      await splinterlands.utils.loadScriptAsync(`https://www.paypal.com/sdk/js?client-id=${splinterlands.get_settings().paypal_client_id}&disable-funding=credit`);
    }

    return paypal.Buttons({
      style: {
        layout: 'horizontal',
        height: 40,
        shape: 'rect',
        size: 'responsive',
        tagline: false,
        display: 'paypal',
      },
      async createOrder(data, actions) {
        const purchaseInfo = await splinterlands.Store.start_purchase(type, get_qty(), 'USD', null, null, 'paypal');

        if (purchaseInfo.code === 'verification_needed') {
          window.dispatchEvent(
            new CustomEvent('splinterlands:system_message', {
              detail: {
                title: 'Verification Needed',
                message: 'Verification is needed for this purchase. Please make your purchase again on our desktop website at https://splinterlands.com.',
              },
            }),
          );

          return { error: 'Verification needed.' };
        }

        // Set up the transaction
        return actions.order.create({
          intent: 'CAPTURE',
          purchase_units: [
            {
              reference_id: purchaseInfo.uid,
              custom_id: purchaseInfo.uid,
              invoice_id: purchaseInfo.uid,
              description: type == 'starter_pack' ? 'Splinterlands Starter Set' : `${purchaseInfo.quantity}X Splinterlands Booster Pack`,
              amount: {
                value: purchaseInfo.amount_usd,
                payee: {
                  email_address: splinterlands.get_settings().paypal_acct,
                  merchant_id: splinterlands.get_settings().paypal_merchant_id,
                },
              },
            },
          ],
        });
      },
      onError(err) {
        console.log(err);
      },
      onApprove(data, actions) {
        splinterlands.log_event('paypal_purchase', data);

        return actions.order
          .capture()
          .then(async function (details) {
            const refID = details.purchase_units[0].reference_id;
            const { orderID } = data;

            const result = await splinterlands.api('/purchases/paypal', { uid: refID, tx: orderID });

            if (result && !result.error) {
              window.dispatchEvent(new CustomEvent('splinterlands:purchase_approved', { detail: result }));
            }

            return result;
          })
          .catch((err) => splinterlands.log_event('paypal_failed', { err, ...data }));
      },
    });
  }

  static async check_code(code) {
    code = code.toUpperCase();
    const result = await splinterlands.api('/purchases/check_code', { code });

    if (!result || !result.valid) {
      return result;
    }

    if (result.type != 'starter_pack') {
      return { error: 'The specified promo code is not currently supported in the mobile app, please try the desktop site.' };
    }

    if (result.type == 'starter_pack' && splinterlands.get_player().starter_pack_purchase) {
      return { error: `This promo code is for a Summoner's Spellbook which has already been purchased for this account.` };
    }

    // Un-hardcode these later when we accept more promo code types
    result.img_url = 'https://d36mxiodymuqjm.cloudfront.net/website/ui_elements/shop/img_spellbook.png';
    result.name = `Summoner's Spellbook`;

    return result;
  }

  static async redeem_code(code) {
    if (typeof code === 'string') {
      code = await splinterlands.api('/purchases/check_code', { code: code.toUpperCase() });
    }

    switch (code.type) {
      case 'starter_pack': {
        const purchase = await splinterlands.Store.start_purchase('starter_pack', 1, 'PROMO');
        return await splinterlands.api('/purchases/start_code', { code: code.code, purchase_id: purchase.uid });
      }
      default:
        return { error: 'The specified promo code is not currently supported.' };
    }
  }

  static async dec_deposit_info(wallet_type) {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
      try {
        switch (wallet_type) {
          case 'steem_engine':
          case 'hive_engine':
            resolve({ address: splinterlands.get_settings().account, browser_payment_available: true });
            break;
          case 'tron': {
            const address = await splinterlands.ec_api('/purchases/get_payment_address', { type: 'dec_deposit', currency: 'TRX', data: '' });
            resolve({ address: address.wallet_address, browser_payment_available: splinterlands.tron.browser_payment_available() });
            break;
          }
          case 'ethereum':
            resolve({ address: splinterlands.get_settings().ethereum.contracts.crystals.address, browser_payment_available: false });
            break;
          case 'bsc':
            resolve({ address: '0xe9d7023f2132d55cbd4ee1f78273cb7a3e74f10a', browser_payment_available: false });
            break;
          default:
            // eslint-disable-next-line prefer-promise-reject-errors
            reject({ error: 'Missing or invalid "wallet_type" parameter.' });
            break;
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  static async mobile_validate(product_id, uid, purchase_token) {
    splinterlands.log_event('mobile_purchase', { product_id, uid, purchase_token });

    const result = await splinterlands.api('/purchases/mobilepurchase', { product_id, uid, purchase_token });

    if (result && !result.error) {
      window.dispatchEvent(new CustomEvent('splinterlands:purchase_approved', { detail: result }));

      return result;
    }
    splinterlands.log_event('mobile_purchase_failed', { result });

    return result;
  }

  static async iOS_validate(product_id, uid, receipt_data) {
    // Apple's receipt data is too large for a query string to handle
    splinterlands.log_event('mobile_purchase_ios', { product_id, uid, receipt_data: encodeURIComponent(`${receipt_data.substr(0, 50)}...`) });

    const query = { product_id, uid };

    const result = await splinterlands.api_post(`/purchases/iospurchase?${splinterlands.utils.param(query)}`, { 'receipt-data': receipt_data });

    if (result && !result.error) {
      window.dispatchEvent(new CustomEvent('splinterlands:purchase_approved', { detail: result }));

      return result;
    }
    splinterlands.log_event('mobile_purchase_failed_ios', { result });

    return result;
  }

  // eslint-disable-next-line consistent-return
  static async restore_iap(product_id, purchase_token) {
    if (splinterlands.is_mobile_app) {
      return new Promise(function (resolve) {
        // Have to wait for home screen/news to finish loading
        setTimeout(resolve, 2000);
      }).then(async function () {
        window.showLoadingAnimation(true, 'Checking In App Purchases\n\nDo not close the app');
        let qty = 0;
        let product_type = 'credits';

        switch (product_id) {
          case 'spellbook':
            product_type = 'starter_pack';
            qty = 1;
            break;
          case 'small':
            qty = 2000;
            break;
          case 'middle':
            qty = 10000;
            break;
          case 'large':
            qty = 20000;
            break;
          case 'purse':
            qty = 50000;
            break;
          case 'bounty':
            qty = 100000;
            break;
          case 'ransom':
            qty = 200000;
            break;
          default:
            console.log('Unknown product_id:', product_id);
            return;
        }

        const purchase = await splinterlands.Store.start_purchase(product_type, qty, 'USD');
        const validate = await splinterlands.Store.mobile_validate(product_id, purchase.uid, purchase_token);

        if (!validate.error) {
          if (splinterlands.mobile_OS === 'android') {
            window.BlockHandler.purchaseVerified(purchase_token, true);
          }
        } else {
          window.showLoadingAnimation(false, 'Checking In App Purchases\n\nDo not close the app');
        }
      });
    }
    console.log('ERROR: Trying to restore non mobile IAP');
  }
};

splinterlands.Purchase = class {
  constructor(data) {
    Object.keys(data).forEach((k) => (this[k] = data[k]));
  }
};
