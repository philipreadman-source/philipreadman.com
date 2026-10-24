// Quality-targeted transcode (Apple VideoToolbox), optionally cropped and scaled:
//   qenc <in> <out> <hevc|h264> <quality 0–1> [W H [cropX cropY cropW cropH]]
// Keeps frame timing; spends bits where the picture changes. Crop is in source pixels (top-left
// origin), applied before scaling to W × H.
import AVFoundation
import CoreImage
let a = CommandLine.arguments
let asset = AVURLAsset(url: URL(fileURLWithPath: a[1]))
let track = asset.tracks(withMediaType: .video)[0]
let src = track.naturalSize.applying(track.preferredTransform)
let srcW = abs(src.width), srcH = abs(src.height)
let outW = a.count > 6 ? Int(a[5])! : Int(srcW), outH = a.count > 6 ? Int(a[6])! : Int(srcH)
let crop = a.count > 10 ? CGRect(x: Double(a[7])!, y: Double(a[8])!, width: Double(a[9])!, height: Double(a[10])!) : CGRect(x: 0, y: 0, width: srcW, height: srcH)
let reader = try! AVAssetReader(asset: asset)
let ro = AVAssetReaderTrackOutput(track: track, outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
reader.add(ro); reader.startReading()
let out = URL(fileURLWithPath: a[2]); try? FileManager.default.removeItem(at: out)
let w = try! AVAssetWriter(outputURL: out, fileType: .mp4)
let hevc = a[3] == "hevc"
var comp: [String: Any] = [AVVideoQualityKey: Double(a[4])!, AVVideoMaxKeyFrameIntervalKey: 240, AVVideoAllowFrameReorderingKey: true]
if !hevc { comp[AVVideoProfileLevelKey] = AVVideoProfileLevelH264HighAutoLevel }
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
  AVVideoCodecKey: hevc ? AVVideoCodecType.hevc : AVVideoCodecType.h264, AVVideoWidthKey: outW, AVVideoHeightKey: outH,
  AVVideoCompressionPropertiesKey: comp,
  AVVideoColorPropertiesKey: [AVVideoColorPrimariesKey: AVVideoColorPrimaries_ITU_R_709_2, AVVideoTransferFunctionKey: AVVideoTransferFunction_ITU_R_709_2, AVVideoYCbCrMatrixKey: AVVideoYCbCrMatrix_ITU_R_709_2]])
input.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange, kCVPixelBufferWidthKey as String: outW, kCVPixelBufferHeightKey as String: outH])
w.add(input); w.startWriting(); w.startSession(atSourceTime: .zero)
let ctx = CIContext(options: [.workingColorSpace: NSNull(), .outputColorSpace: NSNull()])
let sx = Double(outW) / crop.width, sy = Double(outH) / crop.height
var t0: CMTime? = nil
while let sb = ro.copyNextSampleBuffer() {
  guard let pb = CMSampleBufferGetImageBuffer(sb) else { continue }
  let t = CMSampleBufferGetPresentationTimeStamp(sb); if t0 == nil { t0 = t }
  // CI's origin is bottom-left: flip the crop's y
  let ci = CIImage(cvPixelBuffer: pb, options: [.colorSpace: NSNull()])
    .cropped(to: CGRect(x: crop.minX, y: srcH - crop.maxY, width: crop.width, height: crop.height))
    .transformed(by: CGAffineTransform(translationX: -crop.minX, y: -(srcH - crop.maxY)))
    .applyingFilter("CILanczosScaleTransform", parameters: [kCIInputScaleKey: sy, kCIInputAspectRatioKey: sx / sy])
  while !input.isReadyForMoreMediaData { usleep(2000) }
  var po: CVPixelBuffer?; CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &po)
  ctx.render(ci, to: po!, bounds: CGRect(x: 0, y: 0, width: outW, height: outH), colorSpace: nil)
  adaptor.append(po!, withPresentationTime: CMTimeSubtract(t, t0!))
}
input.markAsFinished()
let sem = DispatchSemaphore(value: 0); w.finishWriting { sem.signal() }; sem.wait()
print(a[2].split(separator: "/").last!, w.status == .completed ? "ok \(outW)×\(outH)" : "failed \(w.error?.localizedDescription ?? "")")
