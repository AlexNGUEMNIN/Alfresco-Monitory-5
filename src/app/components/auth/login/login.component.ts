import { Component } from '@angular/core';
import {Router, RouterLink} from '@angular/router';
import {AuthService} from "../../../core/services/auth.service";
import {FormsModule} from "@angular/forms";
import {NgIf} from "@angular/common";

@Component({
    selector: 'app-login',
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.scss'],
    imports: [
        RouterLink,
        FormsModule,
        NgIf
    ],
    standalone: true
})
export class LoginComponent {
    email: string = '';
    password: string = '';
    errorMessage: string = '';
    emailM: string = '';
    passwordM: string = '';

    constructor(private authService: AuthService, private router: Router) {}

    login() {
        this.errorMessage = '';
        this.emailM = '';
        this.passwordM = '';

        // Validate only that the field is not empty
        if (!this.email || this.email.trim().length < 3) {
            this.emailM = 'Nom d’utilisateur ou email invalide';
        }

        if (this.password.length < 3) {
            this.passwordM = 'Mot de passe trop court';
        }

        if (this.emailM || this.passwordM) {
            return;
        }

        this.authService.login(this.email, this.password).subscribe({
            next: () => {
                this.router.navigate(['/dashboard']);
            },
            error: () => {
                this.errorMessage = 'Échec de connexion. Vérifiez vos identifiants.';
            },
        });
    }

}
