import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ConfirmModalConfig {
  show: boolean;
  title: string;
  message: string;
  confirmText: string;
  confirmStyle: string;
  iconPath: string;
  iconColor: string;
}

@Component({
  selector: 'app-stage-confirm-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stage-confirm-modal.html',
})
export class StageConfirmModal {
  @Input() config: ConfirmModalConfig = {
    show: false, title: '', message: '', confirmText: '', confirmStyle: '', iconPath: '', iconColor: '',
  };
  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
}
