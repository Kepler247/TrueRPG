import { TestBed } from '@angular/core/testing';
import { PointBuy, startingScores } from './point-buy';

describe('Interactive point buy', () => {
  it('prevents overspending and scores outside 8-15', () => {
    const fixture = TestBed.createComponent(PointBuy);
    const page = fixture.componentInstance;
    page.standardArray();
    expect(page.remaining()).toBe(0);
    page.change('cha', 1);
    expect(page.scores().cha).toBe(8);
    page.change('str', 1);
    expect(page.scores().str).toBe(15);
    page.change('cha', -1);
    expect(page.scores().cha).toBe(8);
    page.change('str', -1);
    expect(page.remaining()).toBe(2);
  });
  it('resets scores and disables changes during submission', () => {
    const fixture = TestBed.createComponent(PointBuy);
    const page = fixture.componentInstance;
    page.standardArray();
    page.reset();
    expect(page.scores()).toEqual(startingScores());
    fixture.componentRef.setInput('disabled', true);
    page.change('str', 1);
    page.standardArray();
    expect(page.scores()).toEqual(startingScores());
  });
});
