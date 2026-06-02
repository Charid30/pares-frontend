import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RhDashboard } from './rh-dashboard';

describe('RhDashboard', () => {
  let component: RhDashboard;
  let fixture: ComponentFixture<RhDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RhDashboard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RhDashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
