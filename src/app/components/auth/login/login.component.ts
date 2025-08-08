import { Component } from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import { AuthService } from "../../../core/services/auth.service";
import { FormsModule } from "@angular/forms";
import { NgIf } from "@angular/common";

@Component({
  selector: "app-login",
  templateUrl: "./login.component.html",
  styleUrls: ["./login.component.scss"],
  imports: [RouterLink, FormsModule, NgIf],
  standalone: true,
})
export class LoginComponent {
  email: string = "";
  password: string = "";
  errorMessage: string = "";
  emailM: string = "";
  passwordM: string = "";
  isLoading = false;

  constructor(private authService: AuthService, private router: Router) {}

  login() {
    // Reset loading state and clear previous errors
    this.isLoading = true;
    this.errorMessage = "";
    this.emailM = "";
    this.passwordM = "";

    // Validate only that the field is not empty
    if (!this.email || this.email.trim().length < 3) {
      this.emailM = "Nom d’utilisateur ou email invalide";
    }

    if (this.password.length < 3) {
      this.passwordM = "Mot de passe trop court";
    }

    if (this.emailM || this.passwordM) {
      this.isLoading = false;
      return;
    }

    this.authService.login(this.email, this.password).subscribe({
      next: () => {
        // Keep loading state true until navigation completes
        this.router.navigate(["/dashboard"]).then(() => {
          this.isLoading = false;
        });
      },
      error: () => {
        this.isLoading = false;
        this.errorMessage = "Échec de connexion. Vérifiez vos identifiants.";
      },
    });
  }
}
