/*
https://github.com/blackspotbear/kamihubuki-js



The MIT License (MIT)

Copyright (c) 2017 DWANGO Co., Ltd.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/


/**
 * Fin.
 */
export interface Fin {
  /** fin's angle relative to arm */
  angle: number;

  /** fin's size */
  size: number;

  /** arm angle relative to particle (confetti) */
  armAngle: number;

  /** arm's length */
  armLength: number;
}

/**
 * Confetti constructor parameter object.
 */
export interface ConfettiParameterObject {
  /** x position */
  x: number;

  /** y position */
  y: number;

  /** x velocity */
  vx: number;

  /** y velocity */
  vy: number;

  /** angular velocity */
  av: number;

  /** angle */
  angle: number;

  /** mass */
  M: number;

  /** air resistance coefficient */
  K: number;

  /** moment */
  I: number;

  /** angular velocity's damper [0, 1]  */
  RD: number;

  /** fins */
  fins: Fin[];
}

/**
 * Confetti.
 *
 * Y-axis goes bottom to top.
 */
export class Confetti {
  /** x position */
  x: number;

  /** y position */
  y: number;

  /** x velocity */
  vx: number;

  /** y velocity */
  vy: number;

  /** angular velocity */
  av: number;

  /** angle */
  angle: number;

  /** mass */
  M: number;

  /** air resistance coefficient */
  K: number;

  /** moment */
  I: number;

  /** angular velocity's damper [0, 1]  */
  RD: number;

  /** fins */
  fins: Fin[];

  constructor(param: ConfettiParameterObject) {
    this.x = param.x;
    this.y = param.y;
    this.vx = param.vx;
    this.vy = param.vy;
    this.av = param.av;
    this.angle = param.angle;
    this.M = param.M;
    this.K = param.K;
    this.I = param.I;
    this.RD = param.RD;
    this.fins = param.fins;
  }

  /**
   * upadte confetti.
   *
   * @param dt elapse time in sec.
   * @param fx external force x component.
   * @param fy external formce y component.
   * @param gx gravity x component.
   * @param gy gravity y component.
   */
  update(dt: number, fx: number, fy: number, gx: number, gy: number): void {
    const ff = this.calcFinForce(dt, this.fins);

    const ax = (fx + ff.fx - this.vx * this.K) / this.M + gx;
    const ay = (fy + ff.fy - this.vy * this.K) / this.M + gy;
    this.vx += ax * dt;
    this.vy += ay * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const alpha = ff.tau / this.I;
    this.av += alpha * dt;
    this.av *= this.RD;
    this.angle += this.av * dt;
  }

  private calcFinForce(dt: number, fins: Fin[]): { tau: number, fx: number, fy: number; } {
    let totalTau = 0;
    let totalFx = 0;
    let totalFy = 0;

    for (let i = 0; i < fins.length; i++) {
      const fin = fins[i];

      const armWAngle = this.angle + fin.armAngle;
      const armDirX = Math.cos(armWAngle);
      const armDirY = Math.sin(armWAngle);

      const finWAngle = this.angle + fin.armAngle + fin.angle;
      const finNx = Math.cos(finWAngle);
      const finNy = Math.sin(finWAngle);

      // tip speed
      const tvx = this.vx - armDirY * this.av * fin.armLength;
      const tvy = this.vy + armDirX * this.av * fin.armLength;

      // air resistance
      const arfx = -tvx * this.K * fin.size;
      const arfy = -tvy * this.K * fin.size;

      const f = finNx * arfx + finNy * arfy;
      const fx = f * finNx;
      const fy = f * finNy;

      // torque
      totalTau += (armDirX * fy - armDirY * fx) * fin.armLength;

      const af = armDirX * fx + armDirY * fy;
      const afx = af * armDirX;
      const afy = af * armDirY;

      totalFx += afx;
      totalFy += afy;
    }

    return { tau: totalTau, fx: totalFx, fy: totalFy };
  }
}
