import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FinancierDashboard } from './financier-dashboard';

describe('FinancierDashboard', () => {
  let component: FinancierDashboard;
  let fixture: ComponentFixture<FinancierDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FinancierDashboard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FinancierDashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
