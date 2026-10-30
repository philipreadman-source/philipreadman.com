// Encodes a numbered PNG sequence (00000.png…) with Apple VideoToolbox, quality-targeted like qenc:
//   seqenc <framesDir> <out> <hevc|h264> <quality 0–1> [fps, default 60]
import AVFoundation
import CoreImage
import ImageIO
let a = CommandLine.arguments
let dir = URL(fileURLWithPath: a[1])
let fps = a.count > 5 ? Int32(a[5])! : 60
let frames = try! FileManager.default.contentsOfDirectory(atPath: dir.path).filter { $0.hasSuffix(".png") && $0.first!.isNumber }.sorted()
func load(_ name: String) -> CIImage {
  let src = CGImageSourceCreateWithURL(dir.appendingPathComponent(name) as CFURL, nil)!
  return CIImage(cgImage: CGImageSourceCreateImageAtIndex(src, 0, nil)!)
}
let first = load(frames[0]); let outW = Int(first.extent.width), outH = Int(first.extent.height)
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
for (i, f) in frames.enumerated() {
  let img = autoreleasepool { load(f) }
  while !input.isReadyForMoreMediaData { usleep(2000) }
  var po: CVPixelBuffer?; CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &po)
  ctx.render(img, to: po!, bounds: CGRect(x: 0, y: 0, width: outW, height: outH), colorSpace: nil)
  adaptor.append(po!, withPresentationTime: CMTime(value: CMTimeValue(i), timescale: fps))
}
input.markAsFinished()
let sem = DispatchSemaphore(value: 0); w.finishWriting { sem.signal() }; sem.wait()
print(a[2].split(separator: "/").last!, w.status == .completed ? "ok \(outW)×\(outH), \(frames.count) frames" : "failed \(w.error?.localizedDescription ?? "")")
