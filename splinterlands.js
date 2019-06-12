var splinterlands = (function() {
	let _config = {};
	let _player = null;
	let _settings = {};
	let _cards = [];
	let _use_keychain = false;

	async function init(config) { 
		_config = config;

		// Load the game settings
		await load_settings();
		setInterval(load_settings, 60 * 1000);

		// Load the card details
		await load_cards();
	}

	function api(url, data) {
		return new Promise((resolve, reject) => {
			if (data == null || data == undefined) data = {};

			// Add a dummy timestamp parameter to prevent IE from caching the requests.
			data.v = new Date().getTime();

			if (_player) {
				data.token = _player.token;
				data.username = _player.name;
			}

			jQuery.getJSON(_config.api_url + url, data, r => resolve(r));
		});
	}

	async function load_settings() {
		let response = await api('/settings');

		if(_settings.version && _settings.version != response.version) {
			// Dispatch new version event
		}

		_settings = response;
	}

	async function load_cards() { _cards = await api('/cards/get_details'); }

	async function login(username, key) {
		if(!username) {
			username = localStorage.getItem('splinterlands:username');
			key = localStorage.getItem('splinterlands:key');

			if(!username)
				return { success: false, error: 'Username not specified.' };
		}

		// Format the username properly
		username = username.toLowerCase().trim();
		if(username.startsWith('@')) 
			username = username.substr(1);

		// Use the keychain extension if no private key is specified for login
		_use_keychain = !key;

		if(_use_keychain && !window.steem_keychain)
			return { success: false, error: 'Missing private posting key.' };

		if(!_use_keychain) {
			if(key.startsWith('STM'))
				return { success: false, error: 'This appears to be a public key. You must use your private posting key to log in.' };

			// Check if this is a master password, if so try to generate the private key
			if (key && !steem.auth.isWif(key))
				key = steem.auth.getPrivateKeys(username, key, ['posting']).posting;

			// Check that the key is a valid private key.
			try { steem.auth.wifToPublic(key); }
			catch (err) { return { success: false, error: `Invalid password or private posting key for account @${username}` }; }
		}

		// Get the encrypted access token from the server
		var response = await api('/players/login', { name: username, ref: localStorage.getItem('splinterlands:ref') });

		if(!response || response.error)
			return { success: false, error: 'An unknown error occurred trying to log in.' };

		let token = null;

		if(_use_keychain) {
			// Request that the keychain extension decrypt the token
			var keychain_response = await new Promise(resolve => steem_keychain.requestVerifyKey(username, response.token, 'Posting', r => resolve(r)));

			if(!keychain_response || !keychain_response.success)
				return { success: false, error: `The login attempt for account @${username} was unsuccessful.` };

			token = keychain_response.result.startsWith('#') ? keychain_response.result.substr(1) : keychain_response.result;
		} else {
			// Try to decrypt the token using the supplied private key
			try { token = window.decodeMemo(key, response.token).substr(1); } 
			catch (err) { return { success: false, error: 'Invalid password or private posting key for account @' + username, }; }
		}

		_player = response;
		_player.token = token;

		localStorage.setItem('splinterlands:username', username);

		if(!_use_keychain)
			localStorage.setItem('splinterlands:key', key);

		// Start the websocket connection
		splinterlands.socket.connect(_config.ws_url, _player.name, _player.token);

		return _player;
	}

	async function send_tx(id, display_name, data, retries) {
		if(!retries) retries = 0;

		if(!id.startsWith('sm_'))
			id = `sm_${id}`;

		// Add dev mode prefix if specified in settings
		if(_settings.test_mode && !id.startsWith(_settings.prefix))
			id = `${_settings.prefix}${id}`;

		if(!data)
			data = {};

		data.app = `steemmonsters/${_settings.version}`;

		// Generate a random ID for this transaction so we can look it up later
		data.sm_id = splinterlands.utils.randomStr(10);

		// Append the prefix to the app name if in test mode
		if(_settings.test_mode)
			data.app = `${_settings.prefix}${data.app}`;

		let data_str = JSON.stringify(data);

		if(data_str.length > 2000) {
			// TODO: Log this
			return { success: false, error: 'Max custom_json data length exceeded.' };
		}

		// Start waiting for the transaction to be picked up by the server immediately
		var check_tx_promise = check_tx(data.sm_id);

		let broadcast_promise = null;

		if(_use_keychain) {
			broadcast_promise = new Promise(resolve => steem_keychain.requestCustomJson(_player.name, id, 'Posting', data_str, display_name, response => {
				resolve({ 
					type: 'broadcast',
					success: response.success, 
					trx_id: response.success ? response.result.id : null,
					error: response.success ? null : ((typeof response.error == 'string') ? response.error : response.error.message)
				})
			}));
		} else {
			broadcast_promise = new Promise(resolve => steem.broadcast.customJson(localStorage.getItem('splinterlands:key'), [], [_player.name], id, data_str, (err, response) => {
				resolve({
					type: 'broadcast',
					success: (response && response.id),
					trx_id: (response && response.id) ? response.id : null,
					error: err ? err.message : null
				});
			}));
		}

		var result = await Promise.race([check_tx_promise, broadcast_promise]);

		// Check if the transaction was broadcast and picked up by the server before we got the result from the broadcast back
		if(result.type != 'broadcast')
			return result;

		if(result.success) {
			// Wait for the transaction to be picked up by the server
			return await check_tx_promise;
		} else {
			clear_pending_tx(data.sm_id);

			if(result.error == 'user_cancel')
				return result;
			else if(result.error.indexOf('Please wait to transact') >= 0) {
				// TODO: The account is out of Resource Credits, request an SP delegation
			} else if(retries < 2) {
				// Retry the transaction after 3 seconds
				await splinterlands.utils.timeout(3000);
				return await send_tx(id, display_name, data, retries + 1);
			} else
				return result;
		}
	}

	let _transactions = {};
	function check_tx(sm_id) {
		return new Promise(resolve => {
			_transactions[sm_id] = { resolve: resolve };
			
			_transactions[sm_id].timeout = setTimeout(() => {
				if(_transactions[sm_id] && _transactions[sm_id].status != 'complete')
					resolve({ success: false, error: 'Your transaction could not be found. This may be an issue with the Steem Monsters server. Please try refreshing the site to see if the transaction went through.' });

				delete _transactions[sm_id];
			}, 30 * 1000);
		});
	}

	function clear_pending_tx(sm_id) {
		var tx = _transactions[sm_id];

		if(tx) {
			clearTimeout(tx.timeout);
			delete _transactions[sm_id];
		}
	}

	return { 
		init, api, login, send_tx,
		get_settings: () => _settings, 
		get_cards: () => _cards,
		get_player: () => _player,
		get_transaction: (sm_id) => _transactions[sm_id]
	};
})();