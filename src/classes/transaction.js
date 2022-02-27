import utils from '../utils';

class Transaction {
  constructor(data) {
    Object.keys(data).forEach((k) => (this[k] = data[k]));
    this.data = utils.try_parse(this.data);
    this.result = utils.try_parse(this.result);
  }
}

export default Transaction;
