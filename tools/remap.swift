// Re-render a source video along a time map (trimmed-time → source-time pairs), cropped, quality-encoded.
//   remap <src> <map.txt> <out> <hevc|h264> <quality> cropX cropY cropW cropH
// Optional env: SCALE (e.g. 2) upscales with Lanczos; SHARP (e.g. 0.5) then sharpens edges
// (unsharp mask), to firm up UI text when the source is short of pixels
import AVFoundation
import CoreImage
let a = CommandLine.arguments
let map = try! String(contentsOfFile: a[2]).split(separator: "\n").map { $0.split(separator: " ").map { Double($0)! } }
let tEnd = map.last![0] + 0.1
func src(_ t: Double) -> Double { var i = 0; while i + 1 < map.count && map[i+1][0] <= t { i += 1 }; if i + 1 >= map.count { return map[i][1] + (t - map[i][0]) }
  let (t0, s0, t1, s1) = (map[i][0], map[i][1], map[i+1][0], map[i+1][1]); return s0 + (s1 - s0) * (t - t0) / (t1 - t0) }
let cx = Double(a[6])!, cy = Double(a[7])!, cw = Int(a[8])!, ch = Int(a[9])!
let env = ProcessInfo.processInfo.environment
let scale = Double(env["SCALE"] ?? "1")!, sharp = Double(env["SHARP"] ?? "0")!, sharpR = Double(env["SHARP_R"] ?? "2")!
let ow = Int((Double(cw) * scale).rounded()) / 2 * 2, oh = Int((Double(ch) * scale).rounded()) / 2 * 2
let asset = AVURLAsset(url: URL(fileURLWithPath: a[1])); let tr = asset.tracks(withMediaType: .video)[0]; let H = Double(tr.naturalSize.height)
let r = try! AVAssetReader(asset: asset); let o = AVAssetReaderTrackOutput(track: tr, outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]); r.add(o); r.startReading()
let out = URL(fileURLWithPath: a[3]); try? FileManager.default.removeItem(at: out)
let w = try! AVAssetWriter(outputURL: out, fileType: .mp4); let hevc = a[4] == "hevc"
var comp: [String: Any] = [AVVideoQualityKey: Double(a[5])!, AVVideoMaxKeyFrameIntervalKey: 240, AVVideoExpectedSourceFrameRateKey: 60]
if !hevc { comp[AVVideoProfileLevelKey] = AVVideoProfileLevelH264HighAutoLevel }
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [AVVideoCodecKey: hevc ? AVVideoCodecType.hevc : AVVideoCodecType.h264, AVVideoWidthKey: ow, AVVideoHeightKey: oh, AVVideoCompressionPropertiesKey: comp,
  AVVideoColorPropertiesKey: [AVVideoColorPrimariesKey: AVVideoColorPrimaries_ITU_R_709_2, AVVideoTransferFunctionKey: AVVideoTransferFunction_ITU_R_709_2, AVVideoYCbCrMatrixKey: AVVideoYCbCrMatrix_ITU_R_709_2]])
input.expectsMediaDataInRealTime = false
let ad = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange, kCVPixelBufferWidthKey as String: ow, kCVPixelBufferHeightKey as String: oh])
w.add(input); w.startWriting(); w.startSession(atSourceTime: .zero)
let ctx = CIContext(options: [.workingColorSpace: NSNull(), .outputColorSpace: NSNull()])
var cur: (t: Double, img: CIImage)? = nil; var nxt: (t: Double, img: CIImage)? = nil
func read() -> (Double, CIImage)? { guard let sb = o.copyNextSampleBuffer(), let pb = CMSampleBufferGetImageBuffer(sb) else { return nil }; return (CMSampleBufferGetPresentationTimeStamp(sb).seconds, CIImage(cvPixelBuffer: pb, options: [.colorSpace: NSNull()])) }
cur = read(); nxt = read()
var n = 0
while Double(n) / 60 < tEnd {
  let s = src(Double(n) / 60)
  while let nx = nxt, nx.t <= s + 1e-4 { cur = nx; nxt = read() }
  var img = cur!.img.cropped(to: CGRect(x: cx, y: H - cy - Double(ch), width: Double(cw), height: Double(ch))).transformed(by: CGAffineTransform(translationX: -cx, y: -(H - cy - Double(ch))))
  if scale != 1 { img = img.applyingFilter("CILanczosScaleTransform", parameters: [kCIInputScaleKey: scale, kCIInputAspectRatioKey: 1.0]) }
  if sharp > 0 { img = img.clampedToExtent().applyingFilter("CIUnsharpMask", parameters: [kCIInputRadiusKey: sharpR, kCIInputIntensityKey: sharp]).cropped(to: CGRect(x: 0, y: 0, width: Double(ow), height: Double(oh))) }
  while !input.isReadyForMoreMediaData { usleep(2000) }
  var pb: CVPixelBuffer?; CVPixelBufferPoolCreatePixelBuffer(nil, ad.pixelBufferPool!, &pb)
  ctx.render(img, to: pb!, bounds: CGRect(x: 0, y: 0, width: ow, height: oh), colorSpace: nil)
  ad.append(pb!, withPresentationTime: CMTime(value: CMTimeValue(n), timescale: 60)); n += 1
}
input.markAsFinished(); let sem = DispatchSemaphore(value: 0); w.finishWriting { sem.signal() }; sem.wait()
print(a[3].split(separator: "/").last!, w.status == .completed ? "ok \(ow)×\(oh), \(String(format: "%.2f", Double(n)/60))s" : "failed")
