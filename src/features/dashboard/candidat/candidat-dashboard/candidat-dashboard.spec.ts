import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CandidatDashboard } from './candidat-dashboard';

describe('CandidatDashboard', () => {
  let component: CandidatDashboard;
  let fixture: ComponentFixture<CandidatDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CandidatDashboard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CandidatDashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
