import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { AppRoutingModule } from './app-routing.module'; // handles routing
import { AppComponent } from './app.component';
import { VideocallComponent } from './videocall/videocall.component'; // root component

@NgModule({
  declarations: [
    AppComponent,
    VideocallComponent // declares the root component
  ],
  imports: [
    BrowserModule,     // needed for browser apps
    AppRoutingModule,  // adds routing module
    FormsModule        // adds forms module for template-driven forms
  ],
  providers: [],
  bootstrap: [AppComponent] // bootstraps the root component
})
export class AppModule { }
