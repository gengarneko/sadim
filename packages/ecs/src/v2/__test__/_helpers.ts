export class Position {
  x: number;
  y: number;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}

export class Velocity {
  vx: number;
  vy: number;
  constructor(vx: number, vy: number) {
    this.vx = vx;
    this.vy = vy;
  }
}

export class Name {
  name: string;
  constructor(name: string) {
    this.name = name;
  }
}

export class Vec3 {
  x: number;
  y: number;
  z: number;
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
}
