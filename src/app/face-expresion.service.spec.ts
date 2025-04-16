import { TestBed } from '@angular/core/testing';

import { FaceExpresionService } from './face-expresion.service';

describe('FaceExpresionService', () => {
  let service: FaceExpresionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FaceExpresionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
