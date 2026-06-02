import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-loader',
  imports: [CommonModule],
  templateUrl: './loader.html',
  styleUrl: './loader.css',
})
export class Loader {

  @Input() message: string = '';
  @Input() fullscreen: boolean = false;
  @Input() spinnerClass: string = '';
  @Input() backgroundColor: string = 'white';
}