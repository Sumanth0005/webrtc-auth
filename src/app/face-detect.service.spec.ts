import { TestBed } from '@angular/core/testing';

import { FaceDetectService } from './face-detect.service';

describe('FaceDetectService', () => {
  let service: FaceDetectService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FaceDetectService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
