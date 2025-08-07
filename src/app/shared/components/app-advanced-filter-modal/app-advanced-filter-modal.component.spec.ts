import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AppAdvancedFilterModalComponent } from './app-advanced-filter-modal.component';

describe('AppAdvancedFilterModalComponent', () => {
  let component: AppAdvancedFilterModalComponent;
  let fixture: ComponentFixture<AppAdvancedFilterModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppAdvancedFilterModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AppAdvancedFilterModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
