import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { VideocallComponent } from './videocall/videocall.component';
import { FaceAuthComponent } from './face-auth/face-auth.component';

const routes: Routes = [
  { path: '', component: VideocallComponent },
  { path: 'meet/:roomId', component: FaceAuthComponent },
  { path: 'call/:roomId', component: VideocallComponent },
  { path: '**', redirectTo: '' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
