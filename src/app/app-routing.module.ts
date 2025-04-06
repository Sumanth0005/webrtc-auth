import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { VideocallComponent } from './videocall/videocall.component';

const routes: Routes = [
  {path:'', component: VideocallComponent},
  {path:'video/:id', component: VideocallComponent},
  {path: '**', redirectTo: ''},
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
