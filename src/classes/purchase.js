class Purchase {
  constructor(data) {
    Object.keys(data).forEach((k) => (this[k] = data[k]));
  }
}

export default Purchase;
