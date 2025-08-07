import { NgClass, NgIf } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-resetmdp',
  standalone: true,
  imports: [NgIf, NgClass,FormsModule,RouterLink],
  templateUrl: './resetmdp.component.html',
  styleUrl: './resetmdp.component.scss'
})
export class ResetmdpComponent {
passwordsMismatch: any;
confirmPassword: any;
isSuccess: any;
message: any;
newPassword: any;
number: any;
passwordInvalid: any;
onSubmit() {
throw new Error('Method not implemented.');
}

}
