import { NgClass, NgIf } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule, NgModel } from '@angular/forms';


@Component({
  selector: 'app-emailverification',
  standalone: true,
  imports: [NgIf, NgClass, FormsModule],
  templateUrl: './emailverification.component.html',
  styleUrl: './emailverification.component.scss'
})
export class EmailverificationComponent {
emailInvalid: any;
email: any;
onSubmit() {
throw new Error('Method not implemented.');
}
message: any;
isSuccess: any;

}
