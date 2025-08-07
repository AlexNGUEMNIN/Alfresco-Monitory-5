import { NgClass, NgIf } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-verification',
  standalone: true,
  imports: [NgClass,NgIf],
  templateUrl: './verification.component.html',
  styleUrl: './verification.component.scss'
})
export class VerificationComponent {
  verificationCode: string = '';
  message: string = '';
  isSuccess: boolean = false;
  isLoading: boolean = false;
  showPopup: boolean = true; // Affiche le popup une fois
  codeInput: string[] = Array(6).fill(''); // Pour stocker les entrées des codes
  
  constructor(private router: Router, private authService:AuthService) {

  }
  
  // Fonction pour gérer les entrées des codes
  onInput(event: any, index: number) {
    const value = event.target.value;
    this.codeInput[index] = value;
  
    // Si l'input n'est pas vide, passer au champ suivant
    if (value && index < this.codeInput.length - 1) {
      const nextInput = document.querySelector(`.digit-input:nth-of-type(${index + 2})`) as HTMLInputElement;
      nextInput.focus();
    }
  
    // Mettre à jour le code de vérification complet
    this.verificationCode = this.codeInput.join('');
    console.log(this.verificationCode);
    
  }
  
  // validateCode() {
  //   this.isLoading = true;
  //   this.message = '';


    
  //   this.authService.activation(this.verificationCode).subscribe( {
  //     next : (rep) => {


        
  //       console.log(rep)

  //       this.isLoading = false;
  //       this.isSuccess = true;
  //       this.message = 'Code vérifié avec succès !';

  //       this.router.navigate(["/login"]);

        
        
  //     } ,

  //     error : (e) =>{

  //       console.log(e)

  //       this.isLoading = false;
  //       this.isSuccess = false;
  //       this.message = 'Code incorrect, veuillez réessayer.';
      
  //     }
  //   })

  
   
  // }
  
  requestNewCode() {
    this.isLoading = true;
    this.message = '';
  
    // Simuler l'envoi d'un nouveau code (remplacez par votre logique réelle)
    setTimeout(() => {
      this.isLoading = false;
      alert('Un nouveau code a été envoyé à votre email.'); // Notification pour l'utilisateur
    }, 1000); // Simule un délai d'attente
  }
  closePopup() {
    this.showPopup = false; // Fermer le popup
  }
}
