interface ISemigroup<A> {
  combine: (a: A, b: A) => A
}

interface IMonoid<A> extends ISemigroup<A> {
  zero: A
}

class Semigroup<A> implements ISemigroup<A> {
  combine: ISemigroup<A>['combine']

  constructor(combine: ISemigroup<A>['combine']) {
    this.combine = combine
  }
}

class Monoid<A> extends Semigroup<A> {
  zero: IMonoid<A>['zero']

  constructor(combine: ISemigroup<A>['combine'], zero: A) {
    super(combine)
    this.zero = zero
  }
}

const numericSemigroup = new Semigroup((a: number, b: number) => a + b)

const foo = numericSemigroup.combine(2, 2)
