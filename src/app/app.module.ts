import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { AppRoutingModule } from './app-routing.module'; // handles routing
import { AppComponent } from './app.component';
import { VideocallComponent } from './videocall/videocall.component';
import { FaceAuthComponent } from './face-auth/face-auth.component'; // root component
import { HttpClientModule } from '@angular/common/http';

@NgModule({
  declarations: [
    AppComponent,
    VideocallComponent,
    FaceAuthComponent // declares the root component
  ],
  imports: [
    BrowserModule,     // needed for browser apps
    AppRoutingModule,  // adds routing module
    FormsModule ,       // adds forms module for template-driven forms
    HttpClientModule   // adds HTTP client module for making HTTP requests
  ],
  providers: [],
  bootstrap: [AppComponent] // bootstraps the root component
})
export class AppModule { }
