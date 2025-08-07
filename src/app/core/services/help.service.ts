import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class HelpService {

  constructor() { }

  downloadUserGuide(): void {
    // Créer un PDF basique pour les tests
    const pdfContent = this.generateBasicPDF();
    const blob = new Blob([pdfContent], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Guide_Utilisateur_APS_Monitoring.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  private generateBasicPDF(): string {
    // Génération d'un PDF basique en base64 pour les tests
    // En production, ceci sera remplacé par le vrai PDF fourni par l'admin
    const pdfBase64 = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 5 0 R
>>
>>
>>
endobj

4 0 obj
<<
/Length 200
>>
stream
BT
/F1 12 Tf
50 750 Td
(Guide d'utilisation - APS First Monitoring) Tj
0 -30 Td
(Version 1.0 - Afriland First Bank) Tj
0 -50 Td
(1. Introduction) Tj
0 -20 Td
(Ce guide vous aide à utiliser le système de monitoring APS.) Tj
0 -30 Td
(2. Navigation) Tj
0 -20 Td
(Utilisez le menu latéral pour naviguer entre les sections.) Tj
0 -30 Td
(3. Processus) Tj
0 -20 Td
(Surveillez les processus actifs, abandonnés et terminés.) Tj
0 -30 Td
(4. Analyse) Tj
0 -20 Td
(Analysez les tendances et performances du système.) Tj
0 -30 Td
(5. Base de données) Tj
0 -20 Td
(Supervisez la croissance et l'optimisation de la DB.) Tj
0 -30 Td
(6. Administration) Tj
0 -20 Td
(Gérez les utilisateurs et paramètres système.) Tj
ET
endstream
endobj

5 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj

xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000274 00000 n 
0000000526 00000 n 
trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
593
%%EOF`;

    return pdfBase64;
  }
}