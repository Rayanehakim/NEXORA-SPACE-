param([string]$TextureDirectory, [string]$OutputDirectory)
# Orthographic illustrations from credited equirectangular maps; no runtime WebGL.
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
public static class HomeGlobes {
 public static void Render(string input,string output,double longitude) {
  using(var map=new Bitmap(input)) using(var globe=new Bitmap(640,640,PixelFormat.Format32bppArgb)) {
   double radius=316;
   for(int y=0;y<640;y++) for(int x=0;x<640;x++) {
    double nx=(x-319.5)/radius, ny=(319.5-y)/radius, rr=nx*nx+ny*ny;
    if(rr>=1) continue;
    double nz=Math.Sqrt(1-rr), lon=Math.Atan2(nx,nz)+longitude, lat=Math.Asin(ny);
    double u=((lon/(2*Math.PI)+0.5)%1+1)%1, v=0.5-lat/Math.PI;
    Color c=map.GetPixel(Math.Min(map.Width-1,(int)(u*map.Width)),Math.Min(map.Height-1,(int)(v*map.Height)));
    double light=0.08+0.98*Math.Max(0,-0.58*nx+0.32*ny+0.75*nz);
    int a=(int)(255*Math.Min(1,(1-Math.Sqrt(rr))*radius));
    globe.SetPixel(x,y,Color.FromArgb(a,Math.Min(255,(int)(c.R*light)),Math.Min(255,(int)(c.G*light)),Math.Min(255,(int)(c.B*light))));
   }
   globe.Save(output,ImageFormat.Png);
  }
 }
}
'@
[HomeGlobes]::Render((Join-Path $TextureDirectory 'earth.jpg'),(Join-Path $OutputDirectory 'earth.png'),0.25)
[HomeGlobes]::Render((Join-Path $TextureDirectory 'mars.jpg'),(Join-Path $OutputDirectory 'mars.png'),-0.5)
[HomeGlobes]::Render((Join-Path $TextureDirectory 'moon.jpg'),(Join-Path $OutputDirectory 'moon.png'),0)
